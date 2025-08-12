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

Chart.register(ChartDataLabels);

const defaultChartAnimation = {
    duration: 1000,
    easing: 'easeOutQuart'
};

const reverseCategoryMap = {};
for (const [code, name] of Object.entries(categoryMap)) {
    if (code.toUpperCase() === code) {
        reverseCategoryMap[name] = code;
    }
}

const colorPalette = [
    '#B8CEFF', '#A8E6CF', '#B8E3EB', '#FFE7A0', '#FFBCB8',
    '#CBC0D3', '#C6C9D8', '#D1BDFF', '#FFD6B0', '#B0EFEF'
];

let charts = {
    categoryChart: null,
    previousCategoryChart: null,
    subcategoryChart: null,
    scoreCharts: {},
    subcategoryScoreCharts: {}
};

let globalData = [];
let threeMonthData = [];
let threeMonthData_previous = [];
let sixMonthData = [];
let currentMember = 'all';
let currentMemberName = '전체 회원';
let selectedYearMonth = '';
let selectedPeriodText = '';
let isDataFromSupabase = true;

document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    document.getElementById('reportDate').value = `${year}-${month}`;
});

document.getElementById('memberSelect').addEventListener('change', handleMemberChange);
document.getElementById('searchButton').addEventListener('click', handleSearchClick);
document.getElementById('printSelectedMember').addEventListener('click', printSelectedMember);
document.getElementById('printAllMembers').addEventListener('click', printAllMembers);

function printSelectedMember() {
    const printDetailData = document.getElementById('printDetailData').checked;
    
    prepareForPrinting(printDetailData);
    
    window.print();
}

async function printAllMembers() {
    const printDetailData = document.getElementById('printDetailData').checked;
    
    const originalAnimation = Chart.defaults.animation;
    Chart.defaults.animation = false;
    
    const currentSelectedMember = currentMember;
    const currentSelectedMemberName = currentMemberName;
    
    const memberSelect = document.getElementById('memberSelect');
    const members = Array.from(memberSelect.options).slice(1);
    
    if (members.length === 0) {
        alert('출력할 회원이 없습니다.');
        Chart.defaults.animation = originalAnimation;
        return;
    }
    
    try {
        prepareForPrinting(printDetailData);
        
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const memberId = member.value;
            
            currentMember = memberId;
            currentMemberName = member.textContent.split(' (')[0];
            
            updateCharts();
            updateDataTable();
            updateReportTitle();
            
            if (i === 0) {
                window.print();
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
                window.print();
            }
        }
    } catch (error) {
        alert('인쇄 중 오류가 발생했습니다.');
    } finally {
        currentMember = currentSelectedMember;
        currentMemberName = currentSelectedMemberName;
        
        updateCharts();
        updateDataTable();
        updateReportTitle();
        
        Chart.defaults.animation = originalAnimation;
    }
}

function prepareForPrinting(printDetailData) {
    const detailDataCard = document.querySelector('.dashboard-item:last-child');
    if (detailDataCard) {
        detailDataCard.style.display = printDetailData ? 'block' : 'none';
    }
    
    charts.categoryChart?.update();
    charts.previousCategoryChart?.update();
    charts.subcategoryChart?.update();
    
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

async function handleSearchClick() {
    const reportDateElement = document.getElementById('reportDate');
    const selectedDate = reportDateElement.value;
    
    if (!selectedDate) {
        alert('보고서 월을 선택해주세요.');
        return;
    }
    
    try {
        selectedYearMonth = selectedDate;
        
        updatePeriodText(selectedDate);
        
        const journalDataResult = await getJournalSelected(selectedDate);
        
        threeMonthData = journalDataResult.threeMonthData || [];
        threeMonthData_previous = journalDataResult.threeMonthData_previous || [];
        sixMonthData = journalDataResult.sixMonthData || [];
        
        if (sixMonthData.length > 0) {
            threeMonthData = threeMonthData.map(row => {
                const code = row['코드'] || '';
                const categoryCode = code.substring(0, 2);
                const categoryName = categoryMap[categoryCode] || '기타';
                
                const startTime = row['시작시간'] || '';
                let hour = 0;
                
                if (startTime) {
                    const timeStr = startTime.toString().padStart(4, '0');
                    if (timeStr.length >= 3) {
                        hour = parseInt(timeStr.substring(0, timeStr.length - 2));
                    }
                }
                
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
            
            threeMonthData_previous = threeMonthData_previous.map(row => {
                const code = row['코드'] || '';
                const categoryCode = code.substring(0, 2);
                const categoryName = categoryMap[categoryCode] || '기타';
                
                const startTime = row['시작시간'] || '';
                let hour = 0;
                
                if (startTime) {
                    const timeStr = startTime.toString().padStart(4, '0');
                    if (timeStr.length >= 3) {
                        hour = parseInt(timeStr.substring(0, timeStr.length - 2));
                    }
                }
                
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
            
            updateMemberList();
            
            globalData = [...threeMonthData];
            
            updateCharts();
            
            updateDataTable();
            
            updateMonthlyTopCodes(sixMonthData);

            updateReportTitle();
            
            updatePeriodDisplay();
        } else {
            alert('선택한 기간에 데이터가 없습니다.');
        }
    } catch (error) {
        alert('데이터 조회 중 오류가 발생했습니다.');
    }
}

function updatePeriodText(dateString) {
    const selectedDate = new Date(dateString);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    
    const startMonth = month - 2 > 0 ? month - 2 : 12 - (2 - month);
    const startYear = startMonth > month ? year - 1 : year;
    
    selectedPeriodText = `[${startYear}년 ${startMonth}월 ~ ${year}년 ${month}월]`;
}

function updatePeriodDisplay() {
    const targetTitles = [
        '우리집 일상활동',
        '우리집 일상활동 유형별 참여도·만족도·수행도',
        '우리집 일상활동 세부내역별 참여도·만족도·수행도',
        '우리집 어르신 활동 일지'
    ];
    
    document.querySelectorAll('.dashboard-item h2').forEach(h2 => {
        const existingSpan = h2.querySelector('.period-text');
        if (existingSpan) {
            existingSpan.remove();
        }
        
        if (targetTitles.includes(h2.textContent)) {
            const periodSpan = document.createElement('span');
            periodSpan.className = 'period-text';
            periodSpan.textContent = ' ' + selectedPeriodText;
            h2.appendChild(periodSpan);
        }
    });
}

function handleMemberChange(e) {
    currentMember = e.target.value;
    
    if (currentMember === 'all') {
        currentMemberName = '전체 회원';
    } else {
        const selectedOption = e.target.options[e.target.selectedIndex];
        currentMemberName = selectedOption.textContent.split(' (')[0];
    }
    
    updateCharts();
    
    if (isDataFromSupabase && sixMonthData.length > 0) {
        const filteredSixMonthData = currentMember === 'all' 
            ? sixMonthData 
            : sixMonthData.filter(row => row['회원번호'] === currentMember);
            
        updateMonthlyTopCodes(filteredSixMonthData);
    }
    
    updateDataTable();
    
    updateReportTitle();
}

function updateReportTitle() {
    const reportTitleElement = document.querySelector('header h1');
    
    if (reportTitleElement && selectedYearMonth) {
        const year = selectedYearMonth.split('-')[0];
        const month = selectedYearMonth.split('-')[1];
        
        let titleText = `${year}년 ${month}월 `;
        titleText += currentMemberName !== '전체 회원' ? currentMemberName + ' ' : '';
        
        reportTitleElement.innerHTML = titleText + '어르신  <span class="highlight-text"> 우리집</span> 일상 기록';
    }
}

function processData(data) {
    globalData = data.map(row => {
        const code = row['코드'] || '';
        const categoryCode = code.substring(0, 2);
        const categoryName = categoryMap[categoryCode] || '기타';
        
        const startTime = row['시작시간'] || '';
        let hour = 0;
        
        if (startTime) {
            const timeStr = startTime.toString().padStart(4, '0');
            if (timeStr.length >= 3) {
                hour = parseInt(timeStr.substring(0, timeStr.length - 2));
            }
        }
        
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

    updateMemberList();
    
    updateCharts();
    
    updateDataTable();
}

function updateMemberList() {
    const memberSelect = document.getElementById('memberSelect');
    
    while (memberSelect.options.length > 1) {
        memberSelect.remove(1);
    }
    
    const memberData = {};
    threeMonthData.forEach(row => {
        const memberName = row['회원명'];
        const memberId = row['회원번호'] || '';
        if (memberName && memberId) {
            memberData[memberId] = memberName;
        }
    });
    
    const sortedMemberIds = Object.keys(memberData).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        
        return a.localeCompare(b);
    });
    
    sortedMemberIds.forEach(memberId => {
        const memberName = memberData[memberId];
        const option = document.createElement('option');
        option.value = memberId;
        option.textContent = `${memberName} (${memberId})`;
        memberSelect.appendChild(option);
    });
}

function updateCharts() {
    if (!threeMonthData || threeMonthData.length === 0) {
        return;
    }
    
    const filteredData = currentMember === 'all' 
        ? threeMonthData.slice()
        : threeMonthData.filter(row => row['회원번호'] === currentMember);
    
    const filteredPreviousData = currentMember === 'all' 
        ? threeMonthData_previous.slice()
        : threeMonthData_previous.filter(row => row['회원번호'] === currentMember);
    
    updateCategoryChart(filteredData, filteredPreviousData);
    updateSubcategoryChart(filteredData);
    updateScoreCharts(filteredData);
    updateSubcategoryScoreCharts(filteredData);
}

function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    startTime = startTime.toString().padStart(4, '0');
    endTime = endTime.toString().padStart(4, '0');
    
    const startHour = parseInt(startTime.substring(0, 2));
    const startMin = parseInt(startTime.substring(2, 4));
    const endHour = parseInt(endTime.substring(0, 2));
    const endMin = parseInt(endTime.substring(2, 4));
    
    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    
    const durationMinutes = endTotalMinutes < startTotalMinutes 
        ? (endTotalMinutes + 24 * 60) - startTotalMinutes 
        : endTotalMinutes - startTotalMinutes;
    
    return Math.round(durationMinutes / 60 * 100) / 100;
}

function updateCategoryChart(data, previousData) {
    if (!data || data.length === 0) {
        return;
    }
    
    const memberDurations = {};
    const categoryCodeMap = {};
    
    data.forEach(row => {
        if (!row) return;
        
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
    
    if (Object.keys(memberDurations).length === 0) {
        return;
    }
    
    const sortedCategories = Object.keys(memberDurations).sort((a, b) => {
        const codeA = reverseCategoryMap[a] || categoryCodeMap[a] || '';
        const codeB = reverseCategoryMap[b] || categoryCodeMap[b] || '';
        return codeA.localeCompare(codeB);
    });
    
    const durations = sortedCategories.map(category => memberDurations[category]);
    
    const labelsWithCodes = sortedCategories.map(category => {
        const code = reverseCategoryMap[category] || categoryCodeMap[category] || '';
        return `${code}: ${category}`;
    });
    
    try {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) {
            return;
        }
        
        const ctxContext = ctx.getContext('2d');
        
        if (charts.categoryChart) {
            charts.categoryChart.destroy();
        }
        
        const categoryColorMap = {
            'D1': '#B8CEFF',
            'D2': '#A8E6CF',
            'D3': '#B8E3EB',
            'D4': '#FFE7A0',
            'D5': '#FFBCB8',
            'D6': '#CBC0D3',
            'D7': '#C6C9D8',
            'D8': '#D1BDFF',
            'D9': '#FFD6B0'
        };
        
        const categoryColors = sortedCategories.map(category => {
            const code = reverseCategoryMap[category] || categoryCodeMap[category] || '';
            return categoryColorMap[code] || '#20c9a6';
        });
        
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
    }
    
    if (!previousData || previousData.length === 0) {
        document.getElementById('previousCategoryNoData').style.display = 'block';
        
        if (charts.previousCategoryChart) {
            charts.previousCategoryChart.destroy();
            charts.previousCategoryChart = null;
        }
        return;
    }
    
    document.getElementById('previousCategoryNoData').style.display = 'none';
    
    const previousMemberDurations = {};
    const previousCategoryCodeMap = {};
    
    previousData.forEach(row => {
        if (!row) return;
        
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
    
    if (Object.keys(previousMemberDurations).length === 0) {
        document.getElementById('previousCategoryNoData').style.display = 'block';
        
        if (charts.previousCategoryChart) {
            charts.previousCategoryChart.destroy();
            charts.previousCategoryChart = null;
        }
        return;
    }
    
    const sortedPreviousCategories = Object.keys(previousMemberDurations).sort((a, b) => {
        const codeA = reverseCategoryMap[a] || previousCategoryCodeMap[a] || '';
        const codeB = reverseCategoryMap[b] || previousCategoryCodeMap[b] || '';
        return codeA.localeCompare(codeB);
    });
    
    const previousDurations = sortedPreviousCategories.map(category => previousMemberDurations[category]);
    
    const previousLabelsWithCodes = sortedPreviousCategories.map(category => {
        const code = reverseCategoryMap[category] || previousCategoryCodeMap[category] || '';
        return `${code}: ${category}`;
    });
    
    try {
        const previousCtx = document.getElementById('previousCategoryChart');
        if (!previousCtx) {
            return;
        }
        
        const previousCtxContext = previousCtx.getContext('2d');
        
        if (charts.previousCategoryChart) {
            charts.previousCategoryChart.destroy();
        }
        
        const categoryColorMap = {
            'D1': '#B8CEFF',
            'D2': '#A8E6CF',
            'D3': '#B8E3EB',
            'D4': '#FFE7A0',
            'D5': '#FFBCB8',
            'D6': '#CBC0D3',
            'D7': '#C6C9D8',
            'D8': '#D1BDFF',
            'D9': '#FFD6B0'
        };
        
        const previousCategoryColors = sortedPreviousCategories.map(category => {
            const code = reverseCategoryMap[category] || previousCategoryCodeMap[category] || '';
            return categoryColorMap[code] || '#20c9a6';
        });
        
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
    }
}

function updateSubcategoryChart(data) {
    const subcategoryDurations = {};
    
    data.forEach(row => {
        const subcategory = row['코드'];
        const duration = calculateDuration(row['시작시간'], row['종료시간']);
        if (subcategory) {
            subcategoryDurations[subcategory] = (subcategoryDurations[subcategory] || 0) + duration;
        }
    });
    
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
                backgroundColor: '#A8E6CF',
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

function updateScoreCharts(data) {
    const container = document.getElementById('scoreChartsContainer');
    container.innerHTML = '';
    
    const memberScores = {};
    const totalScores = {};
    const categoryCodeMap = {};
    
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
        전체: 'rgba(200, 230, 220, 0.6)',
        개별: '#A8E6CF'
    };

    const sortedCategories = Object.keys(totalScores).sort((a, b) => {
        const codeA = reverseCategoryMap[a] || categoryCodeMap[a] || '';
        const codeB = reverseCategoryMap[b] || categoryCodeMap[b] || '';
        return codeA.localeCompare(codeB);
    });
    
    let chartCount = 0;

    sortedCategories.forEach(category => {
        const showChart = currentMember === 'all' || 
            (memberScores[category] && 
             (memberScores[category].참여도.count > 0 || 
              memberScores[category].만족도.count > 0 || 
              memberScores[category].수행도.count > 0));
        
        if (!showChart) {
            return;
        }
        
        chartCount++;
        
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

        const totalData = metrics.map(metric => {
            const scores = totalScores[category][metric];
            return scores.count > 0 ? parseFloat((scores.sum / scores.count).toFixed(1)) : 0;
        });

        const memberData = currentMember !== 'all' ? metrics.map(metric => {
            const scores = memberScores[category] ? memberScores[category][metric] : null;
            return scores && scores.count > 0 ? parseFloat((scores.sum / scores.count).toFixed(1)) : 0;
        }) : null;

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
}

function updateSubcategoryScoreCharts(data) {
    const container = document.getElementById('subcategoryScoreChartsContainer');
    container.innerHTML = '';
    
    const memberScores = {};
    const totalScores = {};
    
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
    
    const sortedSubcategories = Object.entries(totalScores)
        .sort((a, b) => {
            const countA = a[1].참여도.count + a[1].만족도.count + a[1].수행도.count;
            const countB = b[1].참여도.count + b[1].만족도.count + b[1].수행도.count;
            return countB - countA;
        })
        .slice(0, 10);

    sortedSubcategories.sort((a, b) => {
        const codeA = a[0].split('-')[0] || '';
        const codeB = b[0].split('-')[0] || '';
        return codeA.localeCompare(codeB);
    });
    
    const metrics = ['참여도', '만족도', '수행도'];
    const colors = {
        전체: 'rgba(200, 230, 220, 0.6)',
        개별: '#A8E6CF'
    };
    
    let chartCount = 0;
    
    sortedSubcategories.forEach(([subcategory, scores]) => {
        const showChart = currentMember === 'all' || 
            (memberScores[subcategory] && 
             (memberScores[subcategory].참여도.count > 0 || 
              memberScores[subcategory].만족도.count > 0 || 
              memberScores[subcategory].수행도.count > 0));
        
        if (!showChart) {
            return;
        }
        
        chartCount++;
        const chartItem = document.createElement('div');
        chartItem.className = 'score-chart-item';
        
        const categoryCode = scores.대분류코드.toUpperCase();
        
        chartItem.innerHTML = `
            <h3>${subcategory}</h3>
            <div class="score-chart-container">
                <canvas id="subcategoryScoreChart_${subcategory.replace(/[^a-zA-Z0-9]/g, '_')}"></canvas>
            </div>
        `;
        container.appendChild(chartItem);
        
        const totalData = metrics.map(metric => {
            const metricScores = scores[metric];
            return metricScores.count > 0 ? parseFloat((metricScores.sum / metricScores.count).toFixed(1)) : 0;
        });
        
        const memberData = currentMember !== 'all' ? metrics.map(metric => {
            const memberScore = memberScores[subcategory];
            if (!memberScore) return 0;
            const metricScores = memberScore[metric];
            return metricScores.count > 0 ? parseFloat((metricScores.sum / metricScores.count).toFixed(1)) : 0;
        }) : null;
        
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
}

function updateDataTable() {
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';
    
    const filteredData = currentMember === 'all' 
        ? threeMonthData 
        : threeMonthData.filter(row => row['회원번호'] === currentMember);
    
    const sortedData = [...filteredData].sort((a, b) => {
        const dateA = a['날짜'] ? a['날짜'].toString() : '';
        const dateB = b['날짜'] ? b['날짜'].toString() : '';
        
        if (dateA !== dateB) {
            return dateA.localeCompare(dateB);
        }
        
        const startTimeA = a['시작시간'] ? a['시작시간'].toString().padStart(4, '0') : '0000';
        const startTimeB = b['시작시간'] ? b['시작시간'].toString().padStart(4, '0') : '0000';
        
        return startTimeA.localeCompare(startTimeB);
    });
    
    sortedData.forEach(row => {
        const tr = document.createElement('tr');
        
        let formattedDate = '';
        const dateStr = row['날짜'] ? row['날짜'].toString() : '';
        
        if (dateStr.length === 8) {
            const year = dateStr.substring(2, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            formattedDate = `${year}.${month}.${day}`;
        } else {
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

function updateMonthlyTopCodes(data) {
    const container = document.getElementById('monthlyTopCodesContainer');
    container.innerHTML = '';
    
    const today = new Date();
    const months = [];
    
    for (let i = 0; i < 6; i++) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(month);
    }
    
    let currentRow;
    
    months.forEach((month, index) => {
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
        
        const monthData = data.filter(row => {
            if (!row['날짜']) return false;
            
            const dateStr = row['날짜'].toString().trim();
            let rowYear, rowMonth;
            
            if (isDataFromSupabase) {
                if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('/')) {
                    rowYear = parseInt(dateStr.substring(0, 4));
                    rowMonth = parseInt(dateStr.substring(4, 6));
                    return rowYear === monthYear && rowMonth === monthNum;
                }
            } else {
                if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('/')) {
                    rowYear = parseInt(dateStr.substring(0, 4));
                    rowMonth = parseInt(dateStr.substring(4, 6));
                    return rowYear === monthYear && rowMonth === monthNum;
                }
                
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
        
        const topCodes = Object.entries(codeDurations)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'monthly-table-container';
        tableContainer.style.flex = '1';
        currentRow.appendChild(tableContainer);
        
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
        
        if (topCodes.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="4" style="text-align: center;">데이터가 없습니다.</td>
                </tr>
            `;
        } else {
            topCodes.forEach((item, index) => {
                const fullCode = item[0];
                const duration = item[1];
                const percentage = totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0;
                
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