// Kids Savings Logic
const KS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw03dmTKLEPprmYUmPhxpzzIzOxsPjiHgTdtVvHYYNx-1cO2x7f20QmpX0ofW16qnqm/exec';
let currentKid = '';
let ksData = { namo: [], mona: [] };

// Initial Load Balance
async function ksLoadBalances() {
  try {
    const response = await fetch(`${KS_SCRIPT_URL}?action=read`);
    const result = await response.json();
    if (result && result.success) {
      ksData = result.data;
      
      const namoStats = calculateKidStats(ksData.namo);
      const monaStats = calculateKidStats(ksData.mona);
      
      document.getElementById('ksNamoBalance').innerText = namoStats.balance.toLocaleString('th-TH', {minimumFractionDigits: 2});
      document.getElementById('ksMonaBalance').innerText = monaStats.balance.toLocaleString('th-TH', {minimumFractionDigits: 2});
    }
  } catch(e) {
    console.error("Kids Savings Load Error:", e);
  }
}

function calculateKidStats(transactions) {
  let balance = 0;
  transactions.forEach(t => {
    if (t.type === "ฝาก") balance += t.amount;
    else if (t.type === "ถอน") balance -= t.amount;
  });
  return { balance };
}

// Load Balances on start
ksLoadBalances();

// Select Kid
function ksSelectKid(kid) {
  currentKid = kid === 'namo' ? 'Namo' : 'Mona';
  
  document.getElementById('ksPortal').style.display = 'none';
  document.getElementById('ksActionView').style.display = 'block';
  
  document.getElementById('ksSelectedAvatar').src = kid === 'namo' ? 'Namo.png' : 'Mona.png';
  document.getElementById('ksSelectedName').innerText = kid === 'namo' ? 'นโม (Namo)' : 'โมนา (Mona)';
  
  // Set default date to today when selecting a kid
  document.getElementById('ksDate').valueAsDate = new Date();
  
  // Set current balance based on cache
  const stats = calculateKidStats(ksData[currentKid.toLowerCase()]);
  document.getElementById('ksSelectedBalance').innerText = stats.balance.toLocaleString('th-TH', {minimumFractionDigits: 2});
  
  // Reset tabs to default (Transaction)
  const container = document.getElementById('ksActionView').querySelector('.tabs-container');
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  container.querySelector('.tab-btn[data-tab="ks-transaction"]').classList.add('active');
  document.getElementById('ks-transaction').classList.add('active');
}

function ksBackToPortal() {
  currentKid = '';
  document.getElementById('ksActionView').style.display = 'none';
  document.getElementById('ksPortal').style.display = 'grid';
  // Reload balances to show updated values
  ksLoadBalances();
}

// Submit Transaction
async function ksSubmitTransaction(type, amount, detail, dateVal, formId) {
  if (isNaN(amount) || amount <= 0) {
    Swal.fire('ข้อผิดพลาด', 'กรุณาระบุจำนวนเงินที่ถูกต้อง', 'error');
    return;
  }
  
  showLoading(true);
  
  try {
    const requestUrl = `${KS_SCRIPT_URL}?action=add&sheetName=${currentKid}&type=${encodeURIComponent(type)}&description=${encodeURIComponent(detail)}&amount=${amount}&date=${encodeURIComponent(dateVal)}`;
    
    const response = await fetch(requestUrl);
    const result = await response.json();
    
    if (result && result.success) {
      showLoading(false);
      showToast('บันทึกสำเร็จ!', `บันทึก${type}เงิน ${amount} บาท สำเร็จ`);
      document.getElementById(formId).reset();
      
      // Update local balance immediately
      const kidArr = ksData[currentKid.toLowerCase()];
      kidArr.push({ type: type, amount: parseFloat(amount), date: dateVal });
      const stats = calculateKidStats(kidArr);
      document.getElementById('ksSelectedBalance').innerText = stats.balance.toLocaleString('th-TH', {minimumFractionDigits: 2});
      
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showLoading(false);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรายการได้ โปรดลองอีกครั้ง', 'error');
  }
}

document.getElementById('ksTransactionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = document.querySelector('input[name="ksType"]:checked').value;
  const dateVal = document.getElementById('ksDate').value;
  ksSubmitTransaction(type, document.getElementById('ksAmount').value, document.getElementById('ksDetail').value, dateVal, 'ksTransactionForm');
});

// Dashboard Logic
// Dashboard Logic
let ksChartInstance = null;
function renderKidsSavingsDashboard() {
  if (!ksData || !currentKid) return;
  
  const kidKey = currentKid.toLowerCase();
  const kidData = ksData[kidKey];
  if (!kidData) return;

  let totalDeposit = 0;
  let totalWithdraw = 0;
  
  // Transactions list
  let allTx = [];
  const icon = kidKey === 'namo' ? '👦' : '👧';
  const kidNameThai = kidKey === 'namo' ? 'นโม' : 'โมนา';
  
  kidData.forEach(t => {
    if (t.type === 'ฝาก') totalDeposit += parseFloat(t.amount);
    else if (t.type === 'ถอน') totalWithdraw += parseFloat(t.amount);
    
    allTx.push({...t, kid: kidNameThai, icon: icon});
  });
  
  document.getElementById('ksDashTotalDeposit').innerText = `฿${totalDeposit.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
  document.getElementById('ksDashTotalWithdraw').innerText = `฿${totalWithdraw.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
  
  allTx.sort((a,b) => new Date(b.date) - new Date(a.date));
  const recentTx = allTx.slice(0, 20);
  
  let txHtml = '';
  recentTx.forEach(t => {
    const isDeposit = t.type === 'ฝาก';
    const amountClass = isDeposit ? 'text-success' : 'text-danger';
    const amountSign = isDeposit ? '+' : '-';
    
    // Format Date
    let dateStr = "";
    try {
      const d = new Date(t.date);
      dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()+543}`;
    } catch(e) { dateStr = t.date; }

    txHtml += `
      <div class="list-item">
        <div class="d-flex align-center">
          <div class="me-2 text-center" style="width: 40px; height: 40px; background: #f0f4f8; border-radius: 50%; display:flex; align-items:center; justify-content:center; font-size: 1.2rem;">${t.icon}</div>
          <div>
            <div class="list-item-title">${t.kid} - ${t.type}</div>
            <div class="list-item-subtitle mt-1">${dateStr} | ${t.description || t.detail || ''}</div>
          </div>
        </div>
        <div class="list-item-amount ${amountClass}">${amountSign}฿${parseFloat(t.amount).toLocaleString('th-TH')}</div>
      </div>
    `;
  });
  document.getElementById('ksTransactionList').innerHTML = txHtml || '<div class="text-center text-muted p-4">ไม่มีประวัติรายการ</div>';

  // Chart Rendering
  const ctx = document.getElementById('ksChart').getContext('2d');
  if (ksChartInstance) ksChartInstance.destroy();

  const monthsData = {};
  let cumulative = 0;
  
  [...kidData].sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    cumulative += (t.type === 'ฝาก' ? parseFloat(t.amount) : -parseFloat(t.amount));
    try {
      const d = new Date(t.date);
      const ym = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
      monthsData[ym] = cumulative;
    } catch(e){}
  });
  
  const sortedMonths = Object.keys(monthsData).sort();
  let lastVal = 0;
  const chartData = sortedMonths.map(m => {
    if (monthsData[m] === undefined) return lastVal;
    lastVal = monthsData[m];
    return lastVal;
  });

  const colorBorder = kidKey === 'namo' ? '#36A2EB' : '#FF6384';
  const colorBg = kidKey === 'namo' ? 'rgba(54, 162, 235, 0.1)' : 'rgba(255, 99, 132, 0.1)';

  ksChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedMonths,
      datasets: [
        { 
          label: kidNameThai, 
          data: chartData, 
          borderColor: colorBorder, 
          backgroundColor: colorBg, 
          fill: true, 
          tension: 0.3 
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
    }
  });
}
