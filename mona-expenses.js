// Mona Expenses Logic
const ME_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWIlacxe3-mH2G-TKtNrlWOWAdEiiIfM2jIcsblmN_u2IK7o-X3fLhU-4SjMhnMmNWKw/exec';
let meDataLoaded = false;

document.getElementById('meDate').valueAsDate = new Date();

function meCheckCustomType(select) {
  const group = document.getElementById('meCustomTypeGroup');
  const input = document.getElementById('meCustomType');
  if (select.value === 'อื่นๆ') {
    group.style.display = 'block';
    input.setAttribute('required', 'required');
  } else {
    group.style.display = 'none';
    input.removeAttribute('required');
  }
}

// Form Submit
document.getElementById('meForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoading(true);
  
  let type = document.getElementById('meCategory').value;
  let rawType = type;
  if (type === 'อื่นๆ') {
    type = document.getElementById('meCustomType').value;
  }
  
  let payload = {
    date: document.getElementById('meDate').value,
    type: type,
    rawType: rawType,
    amount: parseFloat(document.getElementById('meAmount').value),
    notes: document.getElementById('meRemark').value
  };
  
  const fileInput = document.getElementById('meFile');
  const file = fileInput.files[0];
  
  try {
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showLoading(false);
        Swal.fire('ไฟล์ใหญ่เกินไป', 'ขนาดไม่เกิน 10MB', 'warning');
        return;
      }
      payload.fileData = await fileToBase64(file);
      payload.fileName = file.name;
      payload.fileMimeType = file.type;
      
      // Remove data URL prefix from base64 string
      payload.fileData = payload.fileData.split(',')[1];
    }
    
    await fetch(ME_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    showLoading(false);
    showToast('บันทึกสำเร็จ!', `บันทึกค่าใช้จ่ายยิมนาสติก ${payload.amount} บาท`);
    
    document.getElementById('meForm').reset();
    document.getElementById('meDate').valueAsDate = new Date();
    document.getElementById('meCustomTypeGroup').style.display = 'none';
    
    meDataLoaded = false; // Reset dashboard loaded state
  } catch (error) {
    showLoading(false);
    showToast('แจ้งเตือน', 'ส่งข้อมูลแล้ว แต่อาจไม่สมบูรณ์ (CORS)', 'info');
  }
});

// Dashboard
async function loadMonaExpensesDashboard() {
  document.getElementById('meDashboardContent').style.display = 'none';
  document.getElementById('meDashboardLoading').style.display = 'block';
  
  try {
    const response = await fetch(ME_SCRIPT_URL);
    const result = await response.json();
    
    if (result && result.success) {
      const data = result.data || [];
      const currentMonth = new Date().toISOString().split('T')[0].substring(0, 7); // YYYY-MM
      const currentYear = currentMonth.substring(0, 4);
      
      let monthTotal = 0;
      let yearTotal = 0;
      let breakdown = {};
      
      data.forEach(item => {
        if (!item.date) return;
        const itemMonth = item.date.substring(0, 7);
        const itemYear = item.date.substring(0, 4);
        
        if (itemMonth === currentMonth) monthTotal += item.amount;
        if (itemYear === currentYear) {
          yearTotal += item.amount;
          breakdown[item.type] = (breakdown[item.type] || 0) + item.amount;
        }
      });
      
      document.getElementById('meMonthTotal').innerText = `฿${monthTotal.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
      document.getElementById('meYearTotal').innerText = `฿${yearTotal.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
      
      // Breakdown List logic removed as we use Pie Chart now

      
      // Pie Chart
      const ctx = document.getElementById('meChart').getContext('2d');
      if (typeof meChartInstance !== 'undefined' && meChartInstance) {
        meChartInstance.destroy();
      }
      const labels = Object.keys(breakdown);
      const dataValues = Object.values(breakdown);
      const colors = ['#EC4899', '#8B5CF6', '#4F46E5', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#14B8A6', '#F43F5E'];
      
      // We need to declare it globally or at least on window
      window.meChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: dataValues,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { font: { family: 'Outfit, Sarabun' }, usePointStyle: true } } }
        }
      });
      
      // Transactions
      const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
      let txHtml = '';
      sortedData.forEach(item => {
        txHtml += `
          <div class="list-item">
            <div>
              <div class="list-item-title">${item.type}</div>
              <div class="list-item-subtitle mt-1">${item.date} ${item.notes ? `| ${item.notes}` : ''}</div>
            </div>
            <div class="list-item-amount text-pink">฿${item.amount.toLocaleString('th-TH')}</div>
          </div>
        `;
      });
      document.getElementById('meTransactionList').innerHTML = txHtml;
      
      meDataLoaded = true;
      document.getElementById('meDashboardLoading').style.display = 'none';
      document.getElementById('meDashboardContent').style.display = 'block';
    }
  } catch (error) {
    document.getElementById('meDashboardLoading').innerHTML = `<p class="text-danger">ไม่สามารถดึงข้อมูลได้: ${error.message}</p>`;
  }
}
