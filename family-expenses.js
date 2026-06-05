// Family Expenses Logic
const FE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxez7PAYXUP_1CSqoz5jNss-ghfdx1GUx1br7Gf4BCmslmi9yRYZFvunJv3LQ6Jvu-U/exec';
let feChartInstance = null;
let feDataLoaded = false;

// Set Default Date
document.getElementById('feDate').valueAsDate = new Date();

// Form Submit
document.getElementById('feForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoading(true);
  
  const fileInput = document.getElementById('feFile');
  const file = fileInput.files[0];
  
  let payload = {
    action: "saveData",
    date: document.getElementById('feDate').value,
    category: document.getElementById('feCategory').value,
    detail: document.getElementById('feDetail').value,
    amount: document.getElementById('feAmount').value,
    remark: document.getElementById('feRemark').value,
    receiptFile: "",
    fileName: ""
  };
  
  try {
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showLoading(false);
        Swal.fire('ไฟล์ใหญ่เกินไป', 'รูปขนาดไม่เกิน 2MB', 'warning');
        return;
      }
      payload.receiptFile = await fileToBase64(file);
      payload.fileName = file.name;
    }
    
    await fetch(FE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    showLoading(false);
    showToast('บันทึกสำเร็จ!', 'ข้อมูลค่าใช้จ่ายครอบครัวถูกบันทึกแล้ว');
    document.getElementById('feForm').reset();
    document.getElementById('feDate').valueAsDate = new Date();
    feDataLoaded = false; // force reload dashboard next time
  } catch (error) {
    showLoading(false);
    showToast('แจ้งเตือน', 'ส่งข้อมูลแล้ว (หรืออาจมีปัญหาอินเทอร์เน็ต)', 'info');
  }
});

// Load Dashboard
async function loadFamilyExpensesDashboard() {
  document.getElementById('feDashboardContent').style.display = 'none';
  document.getElementById('feDashboardLoading').style.display = 'block';
  
  try {
    const response = await fetch(FE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "getSummary" })
    });
    
    const data = await response.json();
    if (data.result === "success") {
      document.getElementById('feMonthName').innerText = data.monthName || "";
      document.getElementById('feTotalAmount').innerText = (data.totalMonth || 0).toLocaleString('th-TH', {minimumFractionDigits: 2});
      
      const labels = data.categories ? Object.keys(data.categories) : [];
      const values = data.categories ? Object.values(data.categories) : [];
      const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8A2BE2', '#00FA9A'];
      
      // Categories List
      let listHTML = '';
      labels.forEach((cat, index) => {
        const val = values[index] || 0;
        listHTML += `
          <div class="list-item">
            <div>
              <span class="dot-indicator" style="background-color: ${colors[index % colors.length]}; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px;"></span>
              ${cat}
            </div>
            <div class="fw-bold">฿${val.toLocaleString('th-TH', {minimumFractionDigits: 2})}</div>
          </div>
        `;
      });
      document.getElementById('feCategoryList').innerHTML = listHTML;
      
      // Transactions
      let txHTML = '';
      if (data.transactions && data.transactions.length > 0) {
        data.transactions.forEach(tx => {
          txHTML += `
            <div class="list-item">
              <div>
                <div class="list-item-title">${tx.detail || 'ไม่ระบุรายละเอียด'}</div>
                <div class="list-item-subtitle mt-1">
                  <span class="list-item-tag">${tx.category}</span>
                  ${tx.date}
                </div>
              </div>
              <div class="list-item-amount text-danger">-฿${tx.amount.toLocaleString('th-TH', {minimumFractionDigits: 2})}</div>
            </div>
          `;
        });
      } else {
        txHTML = '<div class="text-center text-muted p-4">ไม่มีรายการค่าใช้จ่ายในเดือนนี้</div>';
      }
      document.getElementById('feTransactionList').innerHTML = txHTML;
      
      // Chart
      const ctx = document.getElementById('feChart').getContext('2d');
      if (feChartInstance) feChartInstance.destroy();
      
      feChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, hoverOffset: 5 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { font: { family: 'Sarabun' }, usePointStyle: true } } },
          cutout: '65%'
        }
      });
      
      feDataLoaded = true;
      document.getElementById('feDashboardLoading').style.display = 'none';
      document.getElementById('feDashboardContent').style.display = 'block';
      
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    document.getElementById('feDashboardLoading').innerHTML = `<p class="text-danger">โหลดข้อมูลไม่สำเร็จ: ${error.message}</p>`;
  }
}
