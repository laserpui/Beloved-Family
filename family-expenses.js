// Family Expenses Logic
const FE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxez7PAYXUP_1CSqoz5jNss-ghfdx1GUx1br7Gf4BCmslmi9yRYZFvunJv3LQ6Jvu-U/exec';
const FE_SHEET_ID = '15uCkK5vXVg-6zh3nq3gpIOQXI7H-p75kcEDwwdNPRHk';
const FE_SHEET_GID = '2076362911';
let feChartInstance = null;
let feDataLoaded = false;
let feDashboardLoading = false;
let feDashboardAutoRefreshTimer = null;

const feDateInput = document.getElementById('feDate');
if (feDateInput) feDateInput.valueAsDate = new Date();

const feForm = document.getElementById('feForm');
if (feForm) {
  feForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);

    const fileInput = document.getElementById('feFile');
    const file = fileInput.files[0];

    const payload = {
      action: 'saveData',
      date: document.getElementById('feDate').value,
      category: document.getElementById('feCategory').value,
      detail: document.getElementById('feDetail').value,
      amount: document.getElementById('feAmount').value,
      remark: document.getElementById('feRemark').value,
      receiptFile: '',
      fileName: ''
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

      await fetch(`${FE_SCRIPT_URL}?_=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify(payload)
      });

      showLoading(false);
      showToast('บันทึกสำเร็จ!', 'ข้อมูลค่าใช้จ่ายครอบครัวถูกบันทึกแล้ว');
      feForm.reset();
      document.getElementById('feDate').valueAsDate = new Date();
      feDataLoaded = false;

      if (document.getElementById('fe-dashboard')?.classList.contains('active')) {
        loadFamilyExpensesDashboard(true);
      }
    } catch (error) {
      showLoading(false);
      showToast('แจ้งเตือน', 'ส่งข้อมูลแล้ว (หรืออาจมีปัญหาอินเทอร์เน็ต)', 'info');
    }
  });
}

function feEscapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function feFormatSheetCell(cell) {
  if (!cell) return '';
  if (cell.f !== undefined && cell.f !== null) return cell.f;
  if (cell.v instanceof Date) {
    return cell.v.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return cell.v ?? '';
}

function feParseAmount(value) {
  if (typeof value === 'number') return value;
  const numeric = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function feParseDateValue(dateText) {
  const match = String(dateText || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
}

function loadFamilyExpensesSheetTransactions() {
  return new Promise((resolve, reject) => {
    const callbackName = `__feSheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const query = encodeURIComponent('select B,C,D,E,F where B is not null');
    let settled = false;

    const cleanup = () => {
      delete window[callbackName];
      clearTimeout(timeoutId);
      script.remove();
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timeoutId = setTimeout(() => fail(new Error('Sheet direct load timed out')), 7000);

    window[callbackName] = (response) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (!response || response.status === 'error') {
        reject(new Error(response?.errors?.[0]?.detailed_message || 'Unable to read sheet transactions'));
        return;
      }

      const rows = response.table?.rows || [];
      const transactions = rows.map(row => {
        const cells = row.c || [];
        return {
          date: feFormatSheetCell(cells[0]),
          category: feFormatSheetCell(cells[1]),
          detail: feFormatSheetCell(cells[2]),
          amount: feParseAmount(feFormatSheetCell(cells[3])),
          remark: feFormatSheetCell(cells[4])
        };
      }).filter(tx => tx.date && tx.amount > 0);

      transactions.sort((a, b) => feParseDateValue(b.date) - feParseDateValue(a.date));
      resolve(transactions);
    };

    script.onerror = () => fail(new Error('Unable to load sheet transactions'));
    script.src = `https://docs.google.com/spreadsheets/d/${FE_SHEET_ID}/gviz/tq?gid=${FE_SHEET_GID}&headers=1&tqx=responseHandler:${callbackName}&tq=${query}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function loadFamilyExpensesApiSummary() {
  const response = await fetch(`${FE_SCRIPT_URL}?_=${Date.now()}`, {
    method: 'POST',
    cache: 'no-store',
    body: JSON.stringify({ action: 'getSummary' })
  });
  const data = await response.json();
  if (data.result !== 'success') throw new Error(data.error || 'Unable to read API summary');

  return {
    totalAmount: data.totalMonth || 0,
    categories: data.categories || {},
    transactions: data.transactions || [],
    monthName: data.monthName || '',
    source: 'api-monthly'
  };
}

function buildFamilyExpensesSummary(transactions, source = 'sheet-live') {
  const categories = {};
  let totalAmount = 0;

  transactions.forEach(tx => {
    const amount = feParseAmount(tx.amount);
    const category = tx.category || 'ไม่ระบุประเภท';
    totalAmount += amount;
    categories[category] = (categories[category] || 0) + amount;
  });

  return { totalAmount, categories, transactions, source };
}

function renderFamilyExpensesDashboardData(data) {
  const transactions = data.transactions || [];
  const categories = data.categories || {};
  const labels = Object.keys(categories);
  const values = Object.values(categories);
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8A2BE2', '#00FA9A'];
  const sourceLabel = data.source === 'api-monthly' ? (data.monthName || 'รายเดือน') : 'ทั้งหมดใน Sheet';

  document.getElementById('feMonthName').innerText = sourceLabel;
  document.getElementById('feTotalAmount').innerText = (data.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

  const updatedAt = document.getElementById('feLastUpdated');
  if (updatedAt) {
    updatedAt.innerText = `อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }

  let listHTML = '';
  labels.forEach((cat, index) => {
    const val = values[index] || 0;
    listHTML += `
      <div class="list-item">
        <div>
          <span class="dot-indicator" style="background-color: ${colors[index % colors.length]}; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px;"></span>
          ${feEscapeHtml(cat)}
        </div>
        <div class="fw-bold">฿${val.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
      </div>
    `;
  });
  document.getElementById('feCategoryList').innerHTML = listHTML || '<div class="text-center text-muted p-4">ไม่มีข้อมูลแยกตามประเภท</div>';

  let txHTML = '';
  if (transactions.length > 0) {
    transactions.forEach(tx => {
      const detail = feEscapeHtml(tx.detail || 'ไม่ระบุรายละเอียด');
      const category = feEscapeHtml(tx.category || '');
      const date = feEscapeHtml(tx.date || '');
      const remark = tx.remark ? ` | ${feEscapeHtml(tx.remark)}` : '';
      const amount = feParseAmount(tx.amount);

      txHTML += `
        <div class="list-item">
          <div>
            <div class="list-item-title">${detail}</div>
            <div class="list-item-subtitle mt-1">
              <span class="list-item-tag">${category}</span>
              ${date}${remark}
            </div>
          </div>
          <div class="list-item-amount text-danger">-฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
        </div>
      `;
    });
  } else {
    txHTML = '<div class="text-center text-muted p-4">ไม่มีรายการค่าใช้จ่ายใน Sheet</div>';
  }
  document.getElementById('feTransactionList').innerHTML = txHTML;

  const ctx = document.getElementById('feChart').getContext('2d');
  if (feChartInstance) feChartInstance.destroy();

  feChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, hoverOffset: 5 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { family: 'Sarabun' }, usePointStyle: true } } },
      cutout: '65%'
    }
  });
}

async function loadFamilyExpensesDashboard(forceRefresh = false) {
  if (feDashboardLoading) return;
  feDashboardLoading = true;

  document.getElementById('feDashboardContent').style.display = 'none';
  const loading = document.getElementById('feDashboardLoading');
  loading.style.display = 'block';
  loading.innerHTML = '<div class="spinner"></div><p>กำลังดึงข้อมูลสดจาก Sheet...</p>';

  const refreshButton = document.getElementById('feRefreshDashboard');
  if (refreshButton) refreshButton.disabled = true;

  try {
    let dashboardData;
    try {
      const allTransactions = await loadFamilyExpensesSheetTransactions();
      dashboardData = buildFamilyExpensesSummary(allTransactions, 'sheet-live');
    } catch (sheetError) {
      console.warn('Family Expenses live sheet load failed, using API fallback:', sheetError);
      dashboardData = await loadFamilyExpensesApiSummary();
    }

    renderFamilyExpensesDashboardData(dashboardData);
    feDataLoaded = true;
    loading.style.display = 'none';
    document.getElementById('feDashboardContent').style.display = 'block';
  } catch (error) {
    loading.innerHTML = `<p class="text-danger">โหลดข้อมูลไม่สำเร็จ: ${feEscapeHtml(error.message)}</p>`;
  } finally {
    feDashboardLoading = false;
    if (refreshButton) refreshButton.disabled = false;
  }
}

function startFamilyExpensesAutoRefresh() {
  clearInterval(feDashboardAutoRefreshTimer);
  feDashboardAutoRefreshTimer = setInterval(() => {
    const familySectionActive = document.getElementById('family-expenses')?.classList.contains('active');
    const dashboardTabActive = document.getElementById('fe-dashboard')?.classList.contains('active');
    if (familySectionActive && dashboardTabActive && !feDashboardLoading) {
      loadFamilyExpensesDashboard(true);
    }
  }, 30000);
}

function stopFamilyExpensesAutoRefresh() {
  clearInterval(feDashboardAutoRefreshTimer);
  feDashboardAutoRefreshTimer = null;
}

document.getElementById('feRefreshDashboard')?.addEventListener('click', () => {
  feDataLoaded = false;
  loadFamilyExpensesDashboard(true);
});