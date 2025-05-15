// 대분류 정보
const categoryMap = {
    'D1': '학습과지식적용',
    'D2': '일반적과제와요구',
    'D3': '의사소통',
    'D4': '이동',
    'D5': '자기관리',
    'D6': '가정생활',
    'D7': '대인상호작용과대인관계',
    'D8': '주요생활영역',
    'D9': '지역,사회,시민생활',
    'd1': '학습과지식적용',
    'd2': '일반적과제와요구',
    'd3': '의사소통',
    'd4': '이동',
    'd5': '자기관리',
    'd6': '가정생활',
    'd7': '대인상호작용과대인관계',
    'd8': '주요생활영역',
    'd9': '지역,사회,시민생활'
};

// Chart.js 플러그인 등록
Chart.register(ChartDataLabels);

// Chart.js 애니메이션 기본값 저장
const defaultChartAnimation = {
    duration: 1000,
    easing: 'easeOutQuart'
};

// 역방향 대분류 매핑 (이름 -> 코드)
const reverseCategoryMap = {};
for (const [code, name] of Object.entries(categoryMap)) {
    if (code.toUpperCase() === code) { // 대문자 코드만 사용
        reverseCategoryMap[name] = code;
    }
}

// 색상 팔레트
const colorPalette = [
    '#B8CEFF', '#A8E6CF', '#B8E3EB', '#FFE7A0', '#FFBCB8',
    '#CBC0D3', '#C6C9D8', '#D1BDFF', '#FFD6B0', '#B0EFEF'
];

// 차트 객체 저장
let charts = {
    categoryChart: null,
    previousCategoryChart: null, // 이전 3개월 대분류 차트
    subcategoryChart: null,
    scoreCharts: {}, // 대분류별 점수 차트 저장
    subcategoryScoreCharts: {} // 소분류별 점수 차트 저장
};

// 전역 데이터 저장
let globalData = [];
let threeMonthData = [];
let threeMonthData_previous = []; // 이전 3개월 데이터를 위한 변수 추가
let sixMonthData = [];
let currentMember = 'all';
let currentMemberName = '전체 회원';
let selectedYearMonth = '';
let selectedPeriodText = ''; // 선택된 기간 텍스트 (ex: [2025년 3월 ~ 2025년 5월])
let isDataFromSupabase = true; // 데이터 소스 추적 (항상 Supabase 데이터 사용)

// 현재 날짜로 datepicker 초기화
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    document.getElementById('reportDate').value = `${year}-${month}`;
});

// 이벤트 리스너
document.getElementById('memberSelect').addEventListener('change', handleMemberChange);
document.getElementById('searchButton').addEventListener('click', handleSearchClick);
document.getElementById('printSelectedMember').addEventListener('click', printSelectedMember);
document.getElementById('printAllMembers').addEventListener('click', printAllMembers);

// 선택 회원 인쇄 함수
function printSelectedMember() {
    // 체크박스 상태 가져오기
    const printDetailData = document.getElementById('printDetailData').checked;
    
    // 인쇄 준비
    prepareForPrinting(printDetailData);
    
    // 인쇄 실행
    window.print();
}

// 전체 회원 인쇄 함수
async function printAllMembers() {
    // 체크박스 상태 가져오기
    const printDetailData = document.getElementById('printDetailData').checked;
    
    // 차트 애니메이션 비활성화
    const originalAnimation = Chart.defaults.animation;
    Chart.defaults.animation = false;
    
    // 현재 선택된 회원 정보 저장
    const currentSelectedMember = currentMember;
    const currentSelectedMemberName = currentMemberName;
    
    // 회원 목록 가져오기
    const memberSelect = document.getElementById('memberSelect');
    const members = Array.from(memberSelect.options).slice(1); // 첫 번째 옵션(전체 회원) 제외
    
    if (members.length === 0) {
        alert('출력할 회원이 없습니다.');
        // 애니메이션 원상복구
        Chart.defaults.animation = originalAnimation;
        return;
    }
    
    try {
        // 인쇄 준비
        prepareForPrinting(printDetailData);
        
        // 전체 회원 인쇄
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const memberId = member.value;
            
            // 해당 회원으로 데이터 변경
            currentMember = memberId;
            currentMemberName = member.textContent.split(' (')[0]; // 괄호 앞의 회원명만 추출
            
            // 차트 및 테이블 업데이트
            updateCharts();
            updateDataTable();
            updateReportTitle();
            
            // 인쇄 시작 (첫 번째 회원인 경우) 또는 새 페이지 추가 (나머지 회원)
            if (i === 0) {
                window.print();
            } else {
                // 회원 간에 페이지 구분을 위해 약간의 지연 추가
                await new Promise(resolve => setTimeout(resolve, 500));
                window.print();
            }
        }
    } catch (error) {
        console.error('인쇄 중 오류 발생:', error);
        alert('인쇄 중 오류가 발생했습니다.');
    } finally {
        // 원래 선택된 회원으로 복원
        currentMember = currentSelectedMember;
        currentMemberName = currentSelectedMemberName;
        
        // 차트 및 테이블 업데이트
        updateCharts();
        updateDataTable();
        updateReportTitle();
        
        // 차트 애니메이션 복원
        Chart.defaults.animation = originalAnimation;
    }
}

// 인쇄 준비 함수
function prepareForPrinting(printDetailData) {
    // 체크박스 상태에 따라 상세 데이터 카드 표시/숨김
    const detailDataCard = document.querySelector('.dashboard-item:last-child');
    if (detailDataCard) {
        detailDataCard.style.display = printDetailData ? 'block' : 'none';
    }
    
    // 차트 관련 설정 최적화
    charts.categoryChart?.update();
    charts.previousCategoryChart?.update();
    charts.subcategoryChart?.update();
    
    // 모든 차트 업데이트
    for (const key in charts.scoreCharts) {
        if (charts.scoreCharts[key]) {
            charts.scoreCharts[key].update();
        }
    }
    
    for (const key in charts.subcategoryScoreCharts) {
        if (charts.subcategoryScoreCharts[key]) {
            charts.subcategoryScoreCharts[key].update();
        }
    }
}

// 검색 버튼 클릭 처리
async function handleSearchClick() {
    const reportDateElement = document.getElementById('reportDate');
    const selectedDate = reportDateElement.value;
    
    if (!selectedDate) {
        alert('보고서 월을 선택해주세요.');
        return;
    }
    
    try {
        // 저장된 선택 날짜
        selectedYearMonth = selectedDate;
        
        // 선택한 날짜로 3개월 범위 텍스트 계산
        updatePeriodText(selectedDate);
        
        // 선택된 날짜로 데이터 조회
        const journalDataResult = await getJournalSelected(selectedDate);
        
        // 3개월, 이전 3개월, 6개월 데이터 분리
        threeMonthData = journalDataResult.threeMonthData || [];
        threeMonthData_previous = journalDataResult.threeMonthData_previous || [];
        sixMonthData = journalDataResult.sixMonthData || [];
        
        console.log("최근 3개월 데이터 로드:", threeMonthData.length);
        console.log("이전 3개월 데이터 로드:", threeMonthData_previous.length);
        console.log("6개월 데이터 로드:", sixMonthData.length);
        
        if (sixMonthData.length > 0) {
            // 최근 3개월 데이터 전처리 및 추가 필드 계산
            threeMonthData = threeMonthData.map(row => {
                // 코드에서 대분류코드 추출
                const code = row['코드'] || '';
                const categoryCode = code.substring(0, 2);
                const categoryName = categoryMap[categoryCode] || '기타';
                
                // 시간 처리 (Supabase 형식 또는 엑셀 형식 모두 처리)
                const startTime = row['시작시간'] || '';
                let hour = 0;
                
                if (startTime) {
                    // 시간 문자열 처리 (hhmm 형식)
                    const timeStr = startTime.toString().padStart(4, '0');
                    if (timeStr.length >= 3) {
                        hour = parseInt(timeStr.substring(0, timeStr.length - 2));
                    }
                }
                
                // 날짜 처리 (yyyymmdd 형식)
                const dateStr = row['날짜'] ? row['날짜'].toString().padStart(8, '0') : '';
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const formattedDate = dateStr ? `${year}-${month}-${day}` : '';
                
                return {
                    ...row,
                    '대분류코드': categoryCode,
                    '대분류': categoryName,
                    '시간대': hour >= 12 ? '오후' : '오전',
                    '시간(시)': hour,
                    '날짜(형식)': formattedDate
                };
            });
            
            // 이전 3개월 데이터 전처리 및 추가 필드 계산
            threeMonthData_previous = threeMonthData_previous.map(row => {
                // 코드에서 대분류코드 추출
                const code = row['코드'] || '';
                const categoryCode = code.substring(0, 2);
                const categoryName = categoryMap[categoryCode] || '기타';
                
                // 시간 처리 (Supabase 형식 또는 엑셀 형식 모두 처리)
                const startTime = row['시작시간'] || '';
                let hour = 0;
                
                if (startTime) {
                    // 시간 문자열 처리 (hhmm 형식)
                    const timeStr = startTime.toString().padStart(4, '0');
                    if (timeStr.length >= 3) {
                        hour = parseInt(timeStr.substring(0, timeStr.length - 2));
                    }
                }
                
                // 날짜 처리 (yyyymmdd 형식)
                const dateStr = row['날짜'] ? row['날짜'].toString().padStart(8, '0') : '';
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const formattedDate = dateStr ? `${year}-${month}-${day}` : '';
                
                return {
                    ...row,
                    '대분류코드': categoryCode,
                    '대분류': categoryName,
                    '시간대': hour >= 12 ? '오후' : '오전',
                    '시간(시)': hour,
                    '날짜(형식)': formattedDate
                };
            });
            
            console.log("데이터 전처리 완료 - 최근 3개월:", threeMonthData.length);
            console.log("데이터 전처리 완료 - 이전 3개월:", threeMonthData_previous.length);
            
            // 먼저 회원 목록 업데이트 (threeMonthData 기반)
            updateMemberList();
            
            // globalData 설정 (threeMonthData와 동일)
            globalData = [...threeMonthData];
            
            // 차트 업데이트
            updateCharts();
            
            // 테이블 업데이트
            updateDataTable();
            
            // 6개월 데이터로 월별 상위 코드 차트 업데이트
            updateMonthlyTopCodes(sixMonthData);

            // 보고서 타이틀 업데이트
            updateReportTitle();
            
            // 기간 표시 업데이트
            updatePeriodDisplay();
        } else {
            alert('선택한 기간에 데이터가 없습니다.');
        }
    } catch (error) {
        console.error('데이터 조회 중 오류 발생:', error);
        alert('데이터 조회 중 오류가 발생했습니다.');
    }
}

// 선택한 날짜로 3개월 범위 텍스트 계산
function updatePeriodText(dateString) {
    const selectedDate = new Date(dateString);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    
    // 선택한 월의 두 달 전부터 선택한 월까지의 기간
    const startMonth = month - 2 > 0 ? month - 2 : 12 - (2 - month);
    const startYear = startMonth > month ? year - 1 : year;
    
    // [YYYY년 M월 ~ YYYY년 M월] 형식으로 표시
    selectedPeriodText = `[${startYear}년 ${startMonth}월 ~ ${year}년 ${month}월]`;
}

// 특정 h2 제목들 옆에 기간 표시 추가
function updatePeriodDisplay() {
    const targetTitles = [
        '우리집 일상활동',
        '우리집 일상활동 유형별 참여도·만족도·수행도',
        '우리집 일상활동 세부내역별 참여도·만족도·수행도',
        '우리집 어르신 활동 일지'
    ];
    
    // 모든 h2 요소를 순회
    document.querySelectorAll('.dashboard-item h2').forEach(h2 => {
        // 기존 기간 표시가 있으면 제거
        const existingSpan = h2.querySelector('.period-text');
        if (existingSpan) {
            existingSpan.remove();
        }
        
        // 타이틀이 대상 목록에 있는 경우에만 기간 표시 추가
        if (targetTitles.includes(h2.textContent)) {
            const periodSpan = document.createElement('span');
            periodSpan.className = 'period-text';
            periodSpan.textContent = ' ' + selectedPeriodText;
            h2.appendChild(periodSpan);
        }
    });
}

// 회원 변경 처리
function handleMemberChange(e) {
    currentMember = e.target.value;
    
    // 회원명 업데이트
    if (currentMember === 'all') {
        currentMemberName = '전체 회원';
    } else {
        // 선택된 회원의 회원명 찾기
        const selectedOption = e.target.options[e.target.selectedIndex];
        currentMemberName = selectedOption.textContent.split(' (')[0]; // 괄호 앞의 회원명만 추출
    }
    
    // 차트 업데이트 (3개월 데이터 사용)
    updateCharts();
    
    // 월별 상위 코드 업데이트 (6개월 데이터 사용)
    if (isDataFromSupabase && sixMonthData.length > 0) {
        // 6개월 데이터에서 선택된 회원 필터링
        const filteredSixMonthData = currentMember === 'all' 
            ? sixMonthData 
            : sixMonthData.filter(row => row['회원번호'] === currentMember);
            
        updateMonthlyTopCodes(filteredSixMonthData);
    }
    
    // 테이블 업데이트
    updateDataTable();
    
    // 보고서 타이틀 업데이트
    updateReportTitle();
}

// 보고서 타이틀 업데이트 함수 추가
function updateReportTitle() {
    const reportTitleElement = document.querySelector('header h1');
    
    if (reportTitleElement && selectedYearMonth) {
        const year = selectedYearMonth.split('-')[0];
        const month = selectedYearMonth.split('-')[1];
        
        let titleText = `${year}년 ${month}월 `;
        titleText += currentMemberName !== '전체 회원' ? currentMemberName + ' ' : '';
        
        // HTML로 '우리집'을 강조 표시
        reportTitleElement.innerHTML = titleText + '어르신  <span class="highlight-text"> 우리집</span> 일상 기록';
    }
}

// 데이터 처리 (Supabase 또는 엑셀 업로드)
function processData(data) {
    // 데이터 전처리
    globalData = data.map(row => {
        // 코드에서 대분류코드 추출
        const code = row['코드'] || '';
        const categoryCode = code.substring(0, 2);
        const categoryName = categoryMap[categoryCode] || '기타';
        
        // 시간 처리 (Supabase 형식 또는 엑셀 형식 모두 처리)
        const startTime = row['시작시간'] || '';
        let hour = 0;
        
        if (startTime) {
            // 시간 문자열 처리 (hhmm 형식)
            const timeStr = startTime.toString().padStart(4, '0');
            if (timeStr.length >= 3) {
                hour = parseInt(timeStr.substring(0, timeStr.length - 2));
            }
        }
        
        // 날짜 처리 (yyyymmdd 형식)
        const dateStr = row['날짜'] ? row['날짜'].toString().padStart(8, '0') : '';
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const formattedDate = dateStr ? `${year}-${month}-${day}` : '';
        
        return {
            ...row,
            '대분류코드': categoryCode,
            '대분류': categoryName,
            '시간대': hour >= 12 ? '오후' : '오전',
            '시간(시)': hour,
            '날짜(형식)': formattedDate
        };
    });

    // 회원 목록 업데이트
    updateMemberList();
    
    // 차트 업데이트
    updateCharts();
    
    // 테이블 업데이트
    updateDataTable();
}

// 회원 목록 업데이트
function updateMemberList() {
    const memberSelect = document.getElementById('memberSelect');
    
    // 기존 옵션 제거 (전체 회원 제외)
    while (memberSelect.options.length > 1) {
        memberSelect.remove(1);
    }
    
    // 회원 목록 및 회원번호 추출 (threeMonthData 사용)
    const memberData = {};
    threeMonthData.forEach(row => {
        const memberName = row['회원명'];
        const memberId = row['회원번호'] || '';
        if (memberName && memberId) {
            memberData[memberId] = memberName;
        }
    });
    
    // 회원번호 순으로 정렬하기 위해 memberId를 배열로 변환하고 정렬
    const sortedMemberIds = Object.keys(memberData).sort((a, b) => {
        // 회원번호가 숫자인 경우 숫자 크기로 정렬, 아닌 경우 문자열로 정렬
        const numA = parseInt(a);
        const numB = parseInt(b);
        
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;  // 숫자 오름차순
        }
        
        return a.localeCompare(b);  // 문자열 오름차순
    });
    
    // 정렬된 회원번호 순으로 옵션 추가
    sortedMemberIds.forEach(memberId => {
        const memberName = memberData[memberId];
        const option = document.createElement('option');
        option.value = memberId;
        option.textContent = `${memberName} (${memberId})`;
        memberSelect.appendChild(option);
    });
}

// 차트 업데이트
function updateCharts() {
    // threeMonthData 유효성 확인
    console.log("차트 업데이트 시 threeMonthData:", threeMonthData);
    console.log("차트 업데이트 시 threeMonthData_previous:", threeMonthData_previous);
    
    if (!threeMonthData || threeMonthData.length === 0) {
        console.error("threeMonthData가 비어있거나 유효하지 않습니다.");
        return;
    }
    
    // 현재 선택된 회원 데이터 필터링 (최근 3개월 데이터)
    const filteredData = currentMember === 'all' 
        ? threeMonthData.slice() // 배열 복사로 원본 데이터 보존
        : threeMonthData.filter(row => row['회원번호'] === currentMember);
    
    // 현재 선택된 회원의 이전 3개월 데이터 필터링
    const filteredPreviousData = currentMember === 'all' 
        ? threeMonthData_previous.slice() // 배열 복사로 원본 데이터 보존
        : threeMonthData_previous.filter(row => row['회원번호'] === currentMember);
    
    console.log("필터링된 최근 데이터:", filteredData.length);
    console.log("필터링된 이전 데이터:", filteredPreviousData.length);
    
    // 데이터가 비어있는지 확인
    if (filteredData.length === 0) {
        console.warn("필터링된 데이터가 없습니다. 회원:", currentMember);
    }
    
    // 각 차트 업데이트
    updateCategoryChart(filteredData, filteredPreviousData);
    updateSubcategoryChart(filteredData);
    updateScoreCharts(filteredData);
    updateSubcategoryScoreCharts(filteredData);
}

// 시간 계산 함수 (hhmm 형식)
function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    // 시간을 문자열로 변환하고 4자리로 맞추기
    startTime = startTime.toString().padStart(4, '0');
    endTime = endTime.toString().padStart(4, '0');
    
    // 시간과 분으로 분리
    const startHour = parseInt(startTime.substring(0, 2));
    const startMin = parseInt(startTime.substring(2, 4));
    const endHour = parseInt(endTime.substring(0, 2));
    const endMin = parseInt(endTime.substring(2, 4));
    
    // 분 단위로 변환하여 차이 계산
    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    
    // 종료시간이 시작시간보다 작은 경우 (다음날로 넘어가는 경우) 24시간 추가
    const durationMinutes = endTotalMinutes < startTotalMinutes 
        ? (endTotalMinutes + 24 * 60) - startTotalMinutes 
        : endTotalMinutes - startTotalMinutes;
    
    // 시간으로 변환 (소수점 두자리까지)
    return Math.round(durationMinutes / 60 * 100) / 100;
}

// 대분류별 활동 분포 차트 업데이트
function updateCategoryChart(data, previousData) {
    // 디버깅: 데이터 확인
    console.log("최근 원형 차트 데이터:", data);
    console.log("이전 원형 차트 데이터:", previousData);
    
    // 데이터가 비어있는지 확인
    if (!data || data.length === 0) {
        console.error("최근 차트 데이터가 비어 있습니다.");
        return;
    }
    
    // 최근 데이터 처리
    // 현재 선택된 회원의 대분류별 활동 시간 집계
    const memberDurations = {};
    const categoryCodeMap = {}; // 대분류명과 코드 매핑
    
    // 현재 선택된 회원 데이터 집계
    data.forEach(row => {
        if (!row) return; // 데이터 행이 유효한지 확인
        
        const category = row['대분류'];
        const categoryCode = row['대분류코드'];
        const duration = calculateDuration(row['시작시간'], row['종료시간']);
        
        if (category && category !== '기타') {
            memberDurations[category] = (memberDurations[category] || 0) + duration;
            if (categoryCode) {
                categoryCodeMap[category] = categoryCode.toUpperCase();
            }
        }
    });
    
    // 디버깅: 집계된 데이터 확인
    console.log("집계된 최근 대분류 데이터:", memberDurations);
    
    // 대분류 데이터가 비어있는지 확인
    if (Object.keys(memberDurations).length === 0) {
        console.error("집계된 최근 대분류 데이터가 없습니다.");
        return;
    }
    
    // 대분류 코드 기준으로 정렬
    const sortedCategories = Object.keys(memberDurations).sort((a, b) => {
        const codeA = reverseCategoryMap[a] || categoryCodeMap[a] || '';
        const codeB = reverseCategoryMap[b] || categoryCodeMap[b] || '';
        return codeA.localeCompare(codeB);
    });
    
    const durations = sortedCategories.map(category => memberDurations[category]);
    
    // 범례에 코드 추가
    const labelsWithCodes = sortedCategories.map(category => {
        const code = reverseCategoryMap[category] || categoryCodeMap[category] || '';
        return `${code}: ${category}`;
    });
    
    // 디버깅: 차트 데이터 확인
    console.log("최근 차트 라벨:", labelsWithCodes);
    console.log("최근 차트 데이터:", durations);
    
    // 최근 3개월 차트 렌더링
    try {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) {
            console.error("categoryChart 캔버스 요소를 찾을 수 없습니다.");
            return;
        }
        
        const ctxContext = ctx.getContext('2d');
        
        if (charts.categoryChart) {
            charts.categoryChart.destroy();
        }
        
        // 카테고리 코드별 고정 색상 매핑 (파스텔 톤으로 변경)
        const categoryColorMap = {
            'D1': '#B8CEFF', // 학습과지식적용 - 파스텔 블루
            'D2': '#A8E6CF', // 일반적과제와요구 - 파스텔 그린
            'D3': '#B8E3EB', // 의사소통 - 파스텔 스카이블루
            'D4': '#FFE7A0', // 이동 - 파스텔 옐로우
            'D5': '#FFBCB8', // 자기관리 - 파스텔 레드
            'D6': '#CBC0D3', // 가정생활 - 파스텔 그레이퍼플
            'D7': '#C6C9D8', // 대인관계 - 파스텔 그레이블루
            'D8': '#D1BDFF', // 주요생활영역 - 파스텔 퍼플
            'D9': '#FFD6B0'  // 지역사회생활 - 파스텔 오렌지
        };
        
        // 각 카테고리에 맞는 색상 배열 생성
        const categoryColors = sortedCategories.map(category => {
            const code = reverseCategoryMap[category] || categoryCodeMap[category] || '';
            return categoryColorMap[code] || '#20c9a6'; // 기본색상
        });
        
        // 차트 렌더링
        charts.categoryChart = new Chart(ctxContext, {
            type: 'pie',
            data: {
                labels: labelsWithCodes,
                datasets: [
                    {
                        data: durations,
                        backgroundColor: categoryColors,
                        borderWidth: 1,
                        borderColor: '#fff',
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                layout: {
                    padding: {
                        top: 30,
                        bottom: 30,
                        left: 30,
                        right: 30
                    }
                },
                plugins: {
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    datalabels: {
                        display: true,
                        color: '#000',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value, context) {
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return percentage >= 5 ? `${value.toFixed(1)}\n(${percentage}%)` : '';
                        },
                        textAlign: 'center',
                        backgroundColor: 'rgba(255, 253, 240, 0.8)',
                        borderRadius: 4,
                        padding: {
                            top: 5,
                            bottom: 5,
                            left: 8,
                            right: 8
                        },
                        anchor: 'end',
                        align: 'center',
                        offset: -30,
                        clamp: true
                    }
                }
            }
        });
    } catch (error) {
        console.error("최근 차트 렌더링 오류:", error);
    }
    
    // 이전 3개월 데이터 처리
    if (!previousData || previousData.length === 0) {
        console.log("이전 차트 데이터가 비어 있습니다.");
        // 이전 데이터가 없는 경우 메시지 표시
        document.getElementById('previousCategoryNoData').style.display = 'block';
        
        // 이전 차트가 있다면 제거
        if (charts.previousCategoryChart) {
            charts.previousCategoryChart.destroy();
            charts.previousCategoryChart = null;
        }
        return;
    }
    
    // 이전 데이터가 있으면 메시지 숨기기
    document.getElementById('previousCategoryNoData').style.display = 'none';
    
    // 이전 3개월 회원의 대분류별 활동 시간 집계
    const previousMemberDurations = {};
    const previousCategoryCodeMap = {}; // 대분류명과 코드 매핑
    
    // 이전 회원 데이터 집계
    previousData.forEach(row => {
        if (!row) return; // 데이터 행이 유효한지 확인
        
        const category = row['대분류'];
        const categoryCode = row['대분류코드'];
        const duration = calculateDuration(row['시작시간'], row['종료시간']);
        
        if (category && category !== '기타') {
            previousMemberDurations[category] = (previousMemberDurations[category] || 0) + duration;
            if (categoryCode) {
                previousCategoryCodeMap[category] = categoryCode.toUpperCase();
            }
        }
    });
    
    // 이전 데이터가 충분한지 확인
    if (Object.keys(previousMemberDurations).length === 0) {
        console.log("집계된 이전 대분류 데이터가 없습니다.");
        document.getElementById('previousCategoryNoData').style.display = 'block';
        
        // 이전 차트가 있다면 제거
        if (charts.previousCategoryChart) {
            charts.previousCategoryChart.destroy();
            charts.previousCategoryChart = null;
        }
        return;
    }
    
    // 이전 데이터 대분류 코드 기준으로 정렬
    const sortedPreviousCategories = Object.keys(previousMemberDurations).sort((a, b) => {
        const codeA = reverseCategoryMap[a] || previousCategoryCodeMap[a] || '';
        const codeB = reverseCategoryMap[b] || previousCategoryCodeMap[b] || '';
        return codeA.localeCompare(codeB);
    });
    
    const previousDurations = sortedPreviousCategories.map(category => previousMemberDurations[category]);
    
    // 이전 데이터 범례에 코드 추가
    const previousLabelsWithCodes = sortedPreviousCategories.map(category => {
        const code = reverseCategoryMap[category] || previousCategoryCodeMap[category] || '';
        return `${code}: ${category}`;
    });
    
    // 이전 데이터 차트 렌더링
    try {
        const previousCtx = document.getElementById('previousCategoryChart');
        if (!previousCtx) {
            console.error("previousCategoryChart 캔버스 요소를 찾을 수 없습니다.");
            return;
        }
        
        const previousCtxContext = previousCtx.getContext('2d');
        
        if (charts.previousCategoryChart) {
            charts.previousCategoryChart.destroy();
        }
        
        // 카테고리 코드별 고정 색상 매핑 (파스텔 톤으로 변경)
        const categoryColorMap = {
            'D1': '#B8CEFF', // 학습과지식적용 - 파스텔 블루
            'D2': '#A8E6CF', // 일반적과제와요구 - 파스텔 그린
            'D3': '#B8E3EB', // 의사소통 - 파스텔 스카이블루
            'D4': '#FFE7A0', // 이동 - 파스텔 옐로우
            'D5': '#FFBCB8', // 자기관리 - 파스텔 레드
            'D6': '#CBC0D3', // 가정생활 - 파스텔 그레이퍼플
            'D7': '#C6C9D8', // 대인관계 - 파스텔 그레이블루
            'D8': '#D1BDFF', // 주요생활영역 - 파스텔 퍼플
            'D9': '#FFD6B0'  // 지역사회생활 - 파스텔 오렌지
        };
        
        // 각 카테고리에 맞는 색상 배열 생성
        const previousCategoryColors = sortedPreviousCategories.map(category => {
            const code = reverseCategoryMap[category] || previousCategoryCodeMap[category] || '';
            return categoryColorMap[code] || '#20c9a6'; // 기본색상
        });
        
        // 이전 데이터 차트 렌더링
        charts.previousCategoryChart = new Chart(previousCtxContext, {
            type: 'pie',
            data: {
                labels: previousLabelsWithCodes,
                datasets: [
                    {
                        data: previousDurations,
                        backgroundColor: previousCategoryColors,
                        borderWidth: 1,
                        borderColor: '#fff',
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                layout: {
                    padding: {
                        top: 30,
                        bottom: 30,
                        left: 30,
                        right: 30
                    }
                },
                plugins: {
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    datalabels: {
                        display: true,
                        color: '#000',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value) {
                            return value.toFixed(1);
                        },
                        anchor: 'center',
                        align: 'center',
                        offset: 0
                    }
                }
            }
        });
    } catch (error) {
        console.error("이전 차트 렌더링 오류:", error);
    }
}

// 소분류별 활동 빈도 차트 업데이트
function updateSubcategoryChart(data) {
    // 소분류별 활동 시간 집계
    const subcategoryDurations = {};
    
    data.forEach(row => {
        const subcategory = row['코드'];
        const duration = calculateDuration(row['시작시간'], row['종료시간']);
        if (subcategory) {
            subcategoryDurations[subcategory] = (subcategoryDurations[subcategory] || 0) + duration;
        }
    });
    
    // 상위 10개 소분류만 표시
    const sortedSubcategories = Object.entries(subcategoryDurations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labels = sortedSubcategories.map(item => item[0]);
    const durations = sortedSubcategories.map(item => item[1]);
    
    const ctx = document.getElementById('subcategoryChart').getContext('2d');
    
    if (charts.subcategoryChart) {
        charts.subcategoryChart.destroy();
    }
    
    charts.subcategoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '활동 시간',
                data: durations,
                backgroundColor: '#A8E6CF',  // 파스텔 그린으로 변경
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: '소분류별 활동 시간 (상위 10개)',
                    font: {
                        size: 14,
                        weight: 'bold'
                    },
                    padding: {
                        top: 0,
                        bottom: 2
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw || 0;
                            return `${value.toFixed(1)}시간`;
                        }
                    }
                },
                datalabels: {
                    display: true,
                    color: '#000',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: function(value) {
                        return value.toFixed(1) + '시간';
                    },
                    anchor: 'center',
                    align: 'center',
                    offset: 0,
                    padding: 0
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '시간',
                        padding: {
                            top: 0,
                            bottom: 0
                        }
                    },
                    ticks: {
                        padding: 0,
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: 13,
                            weight: 'bold'
                        }
                    }
                }
            },
            layout: {
                padding: {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0
                }
            }
        }
    });
}

// 참여도, 만족도, 수행도 비교 차트 업데이트
function updateScoreCharts(data) {
    // 기존 차트 컨테이너 초기화
    const container = document.getElementById('scoreChartsContainer');
    container.innerHTML = '';
    
    console.log("대분류별 차트 업데이트 시작. 현재 회원:", currentMember);
    
    // 대분류별 평균 점수 계산
    const memberScores = {};
    const totalScores = {};
    const categoryCodeMap = {}; // 대분류명과 코드 매핑
    
    // 전체 회원 데이터 집계
    globalData.forEach(row => {
        const category = row['대분류'];
        const categoryCode = row['대분류코드'];
        
        if (category && category !== '기타') {
            if (!totalScores[category]) {
                totalScores[category] = {
                    참여도: { sum: 0, count: 0 },
                    만족도: { sum: 0, count: 0 },
                    수행도: { sum: 0, count: 0 }
                };
            }
            
            if (row['참여도']) {
                totalScores[category].참여도.sum += parseFloat(row['참여도']);
                totalScores[category].참여도.count++;
            }
            if (row['만족도']) {
                totalScores[category].만족도.sum += parseFloat(row['만족도']);
                totalScores[category].만족도.count++;
            }
            if (row['수행도']) {
                totalScores[category].수행도.sum += parseFloat(row['수행도']);
                totalScores[category].수행도.count++;
            }
            
            categoryCodeMap[category] = categoryCode.toUpperCase();
        }
    });

    // 현재 선택된 회원 데이터 집계
    if (currentMember !== 'all') {
        data.forEach(row => {
            const category = row['대분류'];
            
            if (category && category !== '기타') {
                if (!memberScores[category]) {
                    memberScores[category] = {
                        참여도: { sum: 0, count: 0 },
                        만족도: { sum: 0, count: 0 },
                        수행도: { sum: 0, count: 0 }
                    };
                }
                
                if (row['참여도']) {
                    memberScores[category].참여도.sum += parseFloat(row['참여도']);
                    memberScores[category].참여도.count++;
                }
                if (row['만족도']) {
                    memberScores[category].만족도.sum += parseFloat(row['만족도']);
                    memberScores[category].만족도.count++;
                }
                if (row['수행도']) {
                    memberScores[category].수행도.sum += parseFloat(row['수행도']);
                    memberScores[category].수행도.count++;
                }
            }
        });
    }

    const metrics = ['참여도', '만족도', '수행도'];
    const colors = {
        전체: 'rgba(200, 230, 220, 0.6)',  // 연한 파스텔 그린 (반투명)
        개별: '#A8E6CF'  // 파스텔 그린
    };

    // 대분류 코드 기준으로 정렬
    const sortedCategories = Object.keys(totalScores).sort((a, b) => {
        const codeA = reverseCategoryMap[a] || categoryCodeMap[a] || '';
        const codeB = reverseCategoryMap[b] || categoryCodeMap[b] || '';
        return codeA.localeCompare(codeB);
    });
    
    console.log("정렬된 대분류 목록:", sortedCategories);
    
    // 표시된 차트 수 추적
    let chartCount = 0;

    // 각 대분류별로 차트 생성
    sortedCategories.forEach(category => {
        // 선택한 회원이 아닌 전체 회원 조회인 경우 모든 차트 표시
        const showChart = currentMember === 'all' || 
            // 선택한 회원의 경우, 해당 대분류에 데이터가 있는지 확인
            (memberScores[category] && 
             (memberScores[category].참여도.count > 0 || 
              memberScores[category].만족도.count > 0 || 
              memberScores[category].수행도.count > 0));
        
        // 차트 표시 여부 디버깅 로그
        console.log(`대분류 [${category}] 차트 표시 여부:`, showChart);
        if (currentMember !== 'all' && memberScores[category]) {
            console.log(`  - 참여도 데이터: ${memberScores[category].참여도.count}건`);
            console.log(`  - 만족도 데이터: ${memberScores[category].만족도.count}건`);
            console.log(`  - 수행도 데이터: ${memberScores[category].수행도.count}건`);
        }
        
        // 데이터가 없으면 차트를 생성하지 않음
        if (!showChart) {
            console.log(`  → 대분류 [${category}] 차트 생성 안함 (데이터 없음)`);
            return;
        }
        
        chartCount++;
        
        // 차트 컨테이너 생성
        const chartItem = document.createElement('div');
        chartItem.className = 'score-chart-item';
        
        const code = reverseCategoryMap[category] || categoryCodeMap[category] || '';
        chartItem.innerHTML = `
            <h3>${code}: ${category}</h3>
            <div class="score-chart-container">
                <canvas id="scoreChart_${code}"></canvas>
            </div>
        `;
        container.appendChild(chartItem);

        // 차트 데이터 준비
        const totalData = metrics.map(metric => {
            const scores = totalScores[category][metric];
            return scores.count > 0 ? parseFloat((scores.sum / scores.count).toFixed(1)) : 0;
        });

        const memberData = currentMember !== 'all' ? metrics.map(metric => {
            const scores = memberScores[category] ? memberScores[category][metric] : null;
            return scores && scores.count > 0 ? parseFloat((scores.sum / scores.count).toFixed(1)) : 0;
        }) : null;

        // 차트 생성
        const ctx = document.getElementById(`scoreChart_${code}`).getContext('2d');
        
        if (charts.scoreCharts[code]) {
            charts.scoreCharts[code].destroy();
        }

        charts.scoreCharts[code] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: metrics,
                datasets: [
                    {
                        label: '전체 회원',
                        data: totalData,
                        backgroundColor: colors.전체,
                        borderWidth: 0,
                        barPercentage: 0.5,
                        categoryPercentage: 0.9
                    },
                    ...(memberData ? [{
                        label: currentMemberName,
                        data: memberData,
                        backgroundColor: colors.개별,
                        borderWidth: 0,
                        barPercentage: 0.5,
                        categoryPercentage: 0.9
                    }] : [])
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1
                        },
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                const label = context.dataset.label || '';
                                return `${label}: ${value}점`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#000',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value) {
                            return value.toFixed(1);
                        },
                        textAlign: 'center',
                        backgroundColor: 'rgba(255, 253, 240, 0.8)',
                        borderRadius: 4,
                        padding: {
                            top: 5,
                            bottom: 5,
                            left: 8,
                            right: 8
                        },
                        anchor: 'center',
                        align: 'center',
                        offset: 0
                    }
                }
            }
        });
    });
    
    console.log(`대분류별 차트 업데이트 완료. 생성된 차트 수: ${chartCount}`);
}

// 소분류별 참여도, 만족도, 수행도 비교 차트 업데이트
function updateSubcategoryScoreCharts(data) {
    // 기존 차트 컨테이너 초기화
    const container = document.getElementById('subcategoryScoreChartsContainer');
    container.innerHTML = '';
    
    console.log("소분류별 차트 업데이트 시작. 현재 회원:", currentMember);
    
    // 소분류별 평균 점수 계산
    const memberScores = {};
    const totalScores = {};
    
    // 전체 회원 데이터 집계
    globalData.forEach(row => {
        const subcategory = row['코드'];
        
        if (subcategory) {
            if (!totalScores[subcategory]) {
                totalScores[subcategory] = {
                    참여도: { sum: 0, count: 0 },
                    만족도: { sum: 0, count: 0 },
                    수행도: { sum: 0, count: 0 },
                    대분류: row['대분류'],
                    대분류코드: row['대분류코드']
                };
            }
            
            if (row['참여도']) {
                totalScores[subcategory].참여도.sum += parseFloat(row['참여도']);
                totalScores[subcategory].참여도.count++;
            }
            if (row['만족도']) {
                totalScores[subcategory].만족도.sum += parseFloat(row['만족도']);
                totalScores[subcategory].만족도.count++;
            }
            if (row['수행도']) {
                totalScores[subcategory].수행도.sum += parseFloat(row['수행도']);
                totalScores[subcategory].수행도.count++;
            }
        }
    });
    
    // 현재 선택된 회원 데이터 집계 (전체 회원이 아닌 경우)
    if (currentMember !== 'all') {
        data.forEach(row => {
            const subcategory = row['코드'];
            
            if (subcategory) {
                if (!memberScores[subcategory]) {
                    memberScores[subcategory] = {
                        참여도: { sum: 0, count: 0 },
                        만족도: { sum: 0, count: 0 },
                        수행도: { sum: 0, count: 0 },
                        대분류: row['대분류'],
                        대분류코드: row['대분류코드']
                    };
                }
                
                if (row['참여도']) {
                    memberScores[subcategory].참여도.sum += parseFloat(row['참여도']);
                    memberScores[subcategory].참여도.count++;
                }
                if (row['만족도']) {
                    memberScores[subcategory].만족도.sum += parseFloat(row['만족도']);
                    memberScores[subcategory].만족도.count++;
                }
                if (row['수행도']) {
                    memberScores[subcategory].수행도.sum += parseFloat(row['수행도']);
                    memberScores[subcategory].수행도.count++;
                }
            }
        });
    }
    
    // 활동 수가 많은 상위 10개 소분류만 선택
    const sortedSubcategories = Object.entries(totalScores)
        .sort((a, b) => {
            const countA = a[1].참여도.count + a[1].만족도.count + a[1].수행도.count;
            const countB = b[1].참여도.count + b[1].만족도.count + b[1].수행도.count;
            return countB - countA;
        })
        .slice(0, 10);

    // 코드를 "-"로 분리한 후 첫 번째 부분(대분류 코드)을 기준으로 오름차순 정렬
    sortedSubcategories.sort((a, b) => {
        const codeA = a[0].split('-')[0] || '';
        const codeB = b[0].split('-')[0] || '';
        return codeA.localeCompare(codeB);
    });
    
    console.log("정렬된 소분류 목록:", sortedSubcategories.map(item => item[0]));
    
    const metrics = ['참여도', '만족도', '수행도'];
    const colors = {
        전체: 'rgba(200, 230, 220, 0.6)',  // 연한 파스텔 그린 (반투명)
        개별: '#A8E6CF'  // 파스텔 그린
    };
    
    // 표시된 차트 수 추적
    let chartCount = 0;
    
    // 각 소분류별로 차트 생성
    sortedSubcategories.forEach(([subcategory, scores]) => {
        // 선택한 회원이 아닌 전체 회원 조회인 경우 모든 차트 표시
        const showChart = currentMember === 'all' || 
            // 선택한 회원의 경우, 해당 소분류에 데이터가 있는지 확인
            (memberScores[subcategory] && 
             (memberScores[subcategory].참여도.count > 0 || 
              memberScores[subcategory].만족도.count > 0 || 
              memberScores[subcategory].수행도.count > 0));
        
        // 차트 표시 여부 디버깅 로그
        console.log(`소분류 [${subcategory}] 차트 표시 여부:`, showChart);
        if (currentMember !== 'all' && memberScores[subcategory]) {
            console.log(`  - 참여도 데이터: ${memberScores[subcategory].참여도.count}건`);
            console.log(`  - 만족도 데이터: ${memberScores[subcategory].만족도.count}건`);
            console.log(`  - 수행도 데이터: ${memberScores[subcategory].수행도.count}건`);
        }
        
        // 데이터가 없으면 차트를 생성하지 않음
        if (!showChart) {
            console.log(`  → 소분류 [${subcategory}] 차트 생성 안함 (데이터 없음)`);
            return;
        }
        
        chartCount++;
        // 차트 컨테이너 생성
        const chartItem = document.createElement('div');
        chartItem.className = 'score-chart-item';
        
        // 대분류 코드 가져오기
        const categoryCode = scores.대분류코드.toUpperCase();
        
        chartItem.innerHTML = `
            <h3>${subcategory}</h3>
            <div class="score-chart-container">
                <canvas id="subcategoryScoreChart_${subcategory.replace(/[^a-zA-Z0-9]/g, '_')}"></canvas>
            </div>
        `;
        container.appendChild(chartItem);
        
        // 전체 회원 데이터 준비
        const totalData = metrics.map(metric => {
            const metricScores = scores[metric];
            return metricScores.count > 0 ? parseFloat((metricScores.sum / metricScores.count).toFixed(1)) : 0;
        });
        
        // 선택된 회원 데이터 준비 (있는 경우)
        const memberData = currentMember !== 'all' ? metrics.map(metric => {
            const memberScore = memberScores[subcategory];
            if (!memberScore) return 0;
            const metricScores = memberScore[metric];
            return metricScores.count > 0 ? parseFloat((metricScores.sum / metricScores.count).toFixed(1)) : 0;
        }) : null;
        
        // 차트 생성
        const canvasId = `subcategoryScoreChart_${subcategory.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (charts.subcategoryScoreCharts[subcategory]) {
            charts.subcategoryScoreCharts[subcategory].destroy();
        }
        
        charts.subcategoryScoreCharts[subcategory] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: metrics,
                datasets: [
                    {
                        label: '전체 회원',
                        data: totalData,
                        backgroundColor: colors.전체,
                        borderWidth: 0,
                        barPercentage: 0.5,
                        categoryPercentage: 0.9
                    },
                    ...(memberData ? [{
                        label: currentMemberName,
                        data: memberData,
                        backgroundColor: colors.개별,
                        borderWidth: 0,
                        barPercentage: 0.5,
                        categoryPercentage: 0.9
                    }] : [])
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1
                        },
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw || 0;
                                const label = context.dataset.label || '';
                                return `${label}: ${value}점`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#000',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value) {
                            return value.toFixed(1);
                        },
                        textAlign: 'center',
                        backgroundColor: 'rgba(255, 253, 240, 0.8)',
                        borderRadius: 4,
                        padding: {
                            top: 5,
                            bottom: 5,
                            left: 8,
                            right: 8
                        },
                        anchor: 'center',
                        align: 'center',
                        offset: 0
                    }
                }
            }
        });
    });
    
    console.log(`소분류별 차트 업데이트 완료. 생성된 차트 수: ${chartCount}`);
}

// 데이터 테이블 업데이트
function updateDataTable() {
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';
    
    // 현재 선택된 회원 데이터 필터링 (threeMonthData 사용)
    const filteredData = currentMember === 'all' 
        ? threeMonthData 
        : threeMonthData.filter(row => row['회원번호'] === currentMember);
    
    // 날짜 및 시작시간 기준으로 데이터 정렬
    const sortedData = [...filteredData].sort((a, b) => {
        // 날짜 문자열
        const dateA = a['날짜'] ? a['날짜'].toString() : '';
        const dateB = b['날짜'] ? b['날짜'].toString() : '';
        
        // 날짜 비교 (yyyymmdd 형식)
        if (dateA !== dateB) {
            return dateA.localeCompare(dateB);
        }
        
        // 날짜가 같은 경우, 시작시간으로 비교
        const startTimeA = a['시작시간'] ? a['시작시간'].toString().padStart(4, '0') : '0000';
        const startTimeB = b['시작시간'] ? b['시작시간'].toString().padStart(4, '0') : '0000';
        
        return startTimeA.localeCompare(startTimeB);
    });
    
    // 테이블 행 생성
    sortedData.forEach(row => {
        const tr = document.createElement('tr');
        
        // 날짜 형식 변환 (yyyymmdd -> yy.mm.dd)
        let formattedDate = '';
        const dateStr = row['날짜'] ? row['날짜'].toString() : '';
        
        if (dateStr.length === 8) {
            const year = dateStr.substring(2, 4);  // 연도의 뒤 2자리만 사용
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            formattedDate = `${year}.${month}.${day}`;
        } else {
            // 형식이 맞지 않는 경우 원본 데이터 사용
            formattedDate = isDataFromSupabase && row['날짜(형식)'] ? row['날짜(형식)'] : dateStr;
        }
        
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>${row['시작시간'] || ''}</td>
            <td>${row['종료시간'] || ''}</td>
            <td>${row['코드'] || ''}</td>
            <td>${row['활동명'] || ''}</td>
            <td>${row['참여도'] || ''}</td>
            <td>${row['만족도'] || ''}</td>
            <td>${row['수행도'] || ''}</td>
        `;
        
        tableBody.appendChild(tr);
    });
}

// 월별 상위 활동 코드 업데이트
function updateMonthlyTopCodes(data) {
    const container = document.getElementById('monthlyTopCodesContainer');
    container.innerHTML = '';
    
    // 현재 날짜 기준으로 최근 6개월 계산
    const today = new Date();
    const months = [];
    
    // 최근 6개월 계산
    for (let i = 0; i < 6; i++) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(month);
    }
    
    // 행 컨테이너 생성
    let currentRow;
    
    // 각 월별로 데이터 필터링 및 처리
    months.forEach((month, index) => {
        // 새로운 행 생성 (2개의 테이블마다)
        if (index % 2 === 0) {
            currentRow = document.createElement('div');
            currentRow.className = 'monthly-row';
            currentRow.style.display = 'flex';
            currentRow.style.gap = '20px';
            currentRow.style.marginBottom = '20px';
            container.appendChild(currentRow);
        }
        
        const monthYear = month.getFullYear();
        const monthNum = month.getMonth() + 1;
        const monthName = `${monthYear}년 ${monthNum}월`;
        
        // 해당 월의 데이터 필터링
        const monthData = data.filter(row => {
            if (!row['날짜']) return false;
            
            // 날짜 문자열 파싱
            const dateStr = row['날짜'].toString().trim();
            let rowYear, rowMonth;
            
            // Supabase 데이터 처리 (yyyymmdd 형식)
            if (isDataFromSupabase) {
                // yyyymmdd 형식 처리
                if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('/')) {
                    rowYear = parseInt(dateStr.substring(0, 4));
                    rowMonth = parseInt(dateStr.substring(4, 6));
                    return rowYear === monthYear && rowMonth === monthNum;
                }
            } else {
                // 엑셀 업로드 데이터 처리
                // yyyymmdd 형식 처리
                if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('/')) {
                    rowYear = parseInt(dateStr.substring(0, 4));
                    rowMonth = parseInt(dateStr.substring(4, 6));
                    return rowYear === monthYear && rowMonth === monthNum;
                }
                
                // yyyy-mm-dd 또는 yyyy/mm/dd 형식 처리
                if (dateStr.includes('-')) {
                    const dateParts = dateStr.split('-');
                    if (dateParts.length >= 3) {
                        rowYear = parseInt(dateParts[0]);
                        rowMonth = parseInt(dateParts[1]);
                        return rowYear === monthYear && rowMonth === monthNum;
                    }
                } else if (dateStr.includes('/')) {
                    const dateParts = dateStr.split('/');
                    if (dateParts.length >= 3) {
                        rowYear = parseInt(dateParts[0]);
                        rowMonth = parseInt(dateParts[1]);
                        return rowYear === monthYear && rowMonth === monthNum;
                    }
                }
            }
            
            return false;
        });
        
        // 코드별 활동 시간 집계
        const codeDurations = {};
        let totalDuration = 0;
        
        monthData.forEach(row => {
            const code = row['코드'];
            const duration = calculateDuration(row['시작시간'], row['종료시간']);
            
            if (code) {
                codeDurations[code] = (codeDurations[code] || 0) + duration;
                totalDuration += duration;
            }
        });
        
        // 상위 7개 코드 추출
        const topCodes = Object.entries(codeDurations)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);
        
        // 테이블 컨테이너 생성
        const tableContainer = document.createElement('div');
        tableContainer.className = 'monthly-table-container';
        tableContainer.style.flex = '1';
        currentRow.appendChild(tableContainer);
        
        // 테이블 생성
        let tableHTML = `
            <h3>${monthName}</h3>
            <table class="monthly-top-codes-table">
                <thead>
                    <tr>
                        <th class="rank">순위</th>
                        <th class="code">코드</th>
                        <th class="duration">시간</th>
                        <th class="percentage">비율</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // 데이터가 없는 경우
        if (topCodes.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="4" style="text-align: center;">데이터가 없습니다.</td>
                </tr>
            `;
        } else {
            // 각 코드별 행 추가
            topCodes.forEach((item, index) => {
                const fullCode = item[0];
                const duration = item[1];
                const percentage = totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0;
                
                // 코드를 "-"로 분리하여 두 번째 부분만 표시
                const codeParts = fullCode.split('-');
                const displayCode = codeParts.length > 1 ? codeParts[1] : fullCode;
                
                tableHTML += `
                    <tr>
                        <td class="rank">${index + 1}</td>
                        <td class="code">${displayCode}</td>
                        <td class="duration">${duration.toFixed(1)}시간</td>
                        <td class="percentage">${percentage}%</td>
                    </tr>
                `;
            });
        }
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        tableContainer.innerHTML = tableHTML;
    });
} 