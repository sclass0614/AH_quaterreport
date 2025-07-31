// Supabase 클라이언트 설정
const SUPABASE_URL = "https://dfomeijvzayyszisqflo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmb21laWp2emF5eXN6aXNxZmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4NjYwNDIsImV4cCI6MjA2MDQ0MjA0Mn0.-r1iL04wvPNdBeIvgxqXLF2rWqIUX5Ot-qGQRdYo_qk";

// 전역 Supabase 클라이언트 생성
let supabaseClient;

function initsupabase(){
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseClient;
}

window.supabase=initsupabase();

async function getJournalAll() {
  try {
    if (!supabaseClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    
    // 페이지네이션을 사용하여 모든 데이터를 가져오기
    let allData = [];
    let page = 0;
    const pageSize = 1000; // 한 번에 가져올 데이터 수
    
    while (true) {
      const { data, error } = await supabaseClient
        .from('activities_journal')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('일지 데이터 로드 오류:', error);
        break;
      }
      
      if (!data || data.length === 0) {
        break; // 더 이상 데이터가 없으면 종료
      }
      
      allData = allData.concat(data);
      page++;
      
      // 10만개 제한 (안전장치)
      if (allData.length >= 100000) {
        console.log("10만개 데이터 제한에 도달했습니다.");
        break;
      }
    }

    console.log("총 데이터 개수:", allData.length);
    return allData;
  } catch (error) {
    console.error('오류 발생:', error);
    return [];
  }
}

/**
 * 선택한 년월을 기준으로 3개월 및 6개월치 데이터를 불러오는 함수
 * @param {string} selectedYearMonth - 'YYYY-MM' 형식의 날짜 문자열
 * @returns {Promise<Object>} - threeMonthData, threeMonthData_previous, sixMonthData가 포함된 객체
 */
async function getJournalSelected(selectedYearMonth) {
  try {
    if (!supabaseClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    
    // 선택한 년월에서 년과 월 분리
    const [selectedYear, selectedMonth] = selectedYearMonth.split('-').map(Number);
    
    // 선택한 날짜로부터 시작하는 6개월의 연도-월 배열 생성
    const dateRanges = [];
    for (let i = 0; i < 6; i++) {
      let year = selectedYear;
      let month = selectedMonth - i;
      
      // 월이 0보다 작으면 작년으로 처리
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      // yyyymm 형식의 문자열로 변환
      const yearStr = year.toString();
      const monthStr = month.toString().padStart(2, '0');
      dateRanges.push({
        yearMonth: yearStr + monthStr,
        year,
        month,
        monthIndex: i
      });
    }
    
    // 페이지네이션을 사용하여 날짜 범위에 해당하는 모든 데이터를 가져오기
    let allData = [];
    let page = 0;
    const pageSize = 1000; // 한 번에 가져올 데이터 수
    
    while (true) {
      const { data, error } = await supabaseClient
        .from('activities_journal')
        .select('*')
        .or(dateRanges.map(date => `and(날짜.gte.${date.yearMonth}01,날짜.lte.${date.yearMonth}31)`).join(','))
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('일지 데이터 로드 오류:', error);
        break;
      }
      
      if (!data || data.length === 0) {
        break; // 더 이상 데이터가 없으면 종료
      }
      
      allData = allData.concat(data);
      page++;
      
      // 10만개 제한 (안전장치)
      if (allData.length >= 100000) {
        console.log("10만개 데이터 제한에 도달했습니다.");
        break;
      }
    }

    if (allData.length === 0) {
      return { threeMonthData: [], threeMonthData_previous: [], sixMonthData: [] };
    }
    
    // 최근 3개월 데이터 필터링
    const threeMonthData = allData.filter(row => {
      if (!row['날짜']) return false;
      
      const dateStr = row['날짜'].toString().padStart(8, '0');
      const yearMonth = dateStr.substring(0, 6);
      
      // 최근 3개월 내의 데이터만 필터링
      return dateRanges.slice(0, 3).some(date => date.yearMonth === yearMonth);
    });
    
    // 이전 3개월 데이터 필터링 (인덱스 3-5, 즉 4번째~6번째 월)
    const threeMonthData_previous = allData.filter(row => {
      if (!row['날짜']) return false;
      
      const dateStr = row['날짜'].toString().padStart(8, '0');
      const yearMonth = dateStr.substring(0, 6);
      
      // 이전 3개월 내의 데이터만 필터링 (인덱스 3,4,5)
      return dateRanges.slice(3, 6).some(date => date.yearMonth === yearMonth);
    });
    
    // 6개월 데이터는 원본 데이터 그대로 사용
    const sixMonthData = allData;
    
    console.log("최근 3개월 데이터:", threeMonthData.length);
    console.log("이전 3개월 데이터:", threeMonthData_previous.length);
    console.log("6개월 데이터:", sixMonthData.length);
    
    return { threeMonthData, threeMonthData_previous, sixMonthData };
  } catch (error) {
    console.error('오류 발생:', error);
    return { threeMonthData: [], threeMonthData_previous: [], sixMonthData: [] };
  }
}