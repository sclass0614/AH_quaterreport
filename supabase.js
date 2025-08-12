const SUPABASE_URL = "https://dfomeijvzayyszisqflo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmb21laWp2emF5eXN6aXNxZmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4NjYwNDIsImV4cCI6MjA2MDQ0MjA0Mn0.-r1iL04wvPNdBeIvgxqXLF2rWqIUX5Ot-qGQRdYo_qk";

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
    
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabaseClient
        .from('activities_journal')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        break;
      }
      
      if (!data || data.length === 0) {
        break;
      }
      
      allData = allData.concat(data);
      page++;
      
      if (allData.length >= 100000) {
        break;
      }
    }

    return allData;
  } catch (error) {
    return [];
  }
}

async function getJournalSelected(selectedYearMonth) {
  try {
    if (!supabaseClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    
    const [selectedYear, selectedMonth] = selectedYearMonth.split('-').map(Number);
    
    const dateRanges = [];
    for (let i = 0; i < 6; i++) {
      let year = selectedYear;
      let month = selectedMonth - i;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      const yearStr = year.toString();
      const monthStr = month.toString().padStart(2, '0');
      dateRanges.push({
        yearMonth: yearStr + monthStr,
        year,
        month,
        monthIndex: i
      });
    }
    
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabaseClient
        .from('activities_journal')
        .select('*')
        .or(dateRanges.map(date => `and(날짜.gte.${date.yearMonth}01,날짜.lte.${date.yearMonth}31)`).join(','))
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        break;
      }
      
      if (!data || data.length === 0) {
        break;
      }
      
      allData = allData.concat(data);
      page++;
      
      if (allData.length >= 100000) {
        break;
      }
    }

    if (allData.length === 0) {
      return { threeMonthData: [], threeMonthData_previous: [], sixMonthData: [] };
    }
    
    const threeMonthData = allData.filter(row => {
      if (!row['날짜']) return false;
      
      const dateStr = row['날짜'].toString().padStart(8, '0');
      const yearMonth = dateStr.substring(0, 6);
      
      return dateRanges.slice(0, 3).some(date => date.yearMonth === yearMonth);
    });
    
    const threeMonthData_previous = allData.filter(row => {
      if (!row['날짜']) return false;
      
      const dateStr = row['날짜'].toString().padStart(8, '0');
      const yearMonth = dateStr.substring(0, 6);
      
      return dateRanges.slice(3, 6).some(date => date.yearMonth === yearMonth);
    });
    
    const sixMonthData = allData;
    
    return { threeMonthData, threeMonthData_previous, sixMonthData };
  } catch (error) {
    return { threeMonthData: [], threeMonthData_previous: [], sixMonthData: [] };
  }
}