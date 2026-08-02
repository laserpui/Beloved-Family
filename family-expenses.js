// Family Expenses Logic
const FE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxez7PAYXUP_1CSqoz5jNss-ghfdx1GUx1br7Gf4BCmslmi9yRYZFvunJv3LQ6Jvu-U/exec';
const FE_SHEET_ID = '15uCkK5vXVg-6zh3nq3gpIOQXI7H-p75kcEDwwdNPRHk';
const FE_SHEET_GID = '2076362911';
const FE_REQUEST_TIMEOUT_MS = 15000;
let feChartInstance = null;
let feDataLoaded = false;
let feDashboardLoading = false;
let feDashboardAutoRefreshTimer = null;
let feCurrentDashboardData = null;

const feDateInput = document.getElementById('feDate');
if (feDateInput) feDateInput.value = BelovedUtils.getLocalDateInputValue();

const feForm = document.getElementById('feForm');
if (feForm) {
  feForm.addEventListener('submit', async event => {
    event.preventDefault();

    const amount = BelovedUtils.validatePositiveAmount(document.getElementById('feAmount').value);
    if (amount === null) {
      await showFormError('จำนวนเงินไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินที่มากกว่า 0 บาท');
      return;
    }

    const file = document.getElementById('feFile').files[0];
    const submitButton = document.getElementById('feSubmitButton');
    const payload = {
      action: 'saveData',
      date: document.getElementById('feDate').value,
      category: document.getElementById('feCategory').value,
      detail: document.getElementById('feDetail').value.trim(),
      amount,
      remark: document.getElementById('feRemark').value.trim(),
      receiptFile: '',
      fileName: ''
    };

    setButtonBusy(submitButton, true);
    showLoading(true, 'กำลังบันทึกค่าใช้จ่ายครอบครัว...');

    try {
      if (file) {
        if (file.size > 2 * 1024 * 1024) throw new Error('รูปใบเสร็จต้องมีขนาดไม่เกิน 2MB');
        if (!file.type.startsWith('image/')) throw new Error('ไฟล์ใบเสร็จต้องเป็นรูปภาพเท่านั้น');
        payload.receiptFile = await fileToBase64(file);
        payload.fileName = file.name;
      }

      const response = await BelovedUtils.fetchWithTimeout(`${FE_SCRIPT_URL}?_=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }, FE_REQUEST_TIMEOUT_MS);

      if (response.type !== 'opaque' && !response.ok) {
        throw new Error(`Family Expenses API ตอบกลับ ${response.status}`);
      }

      feForm.reset();
      document.getElementById('feDate').value = BelovedUtils.getLocalDateInputValue();
      feDataLoaded = false;

      showToast(
        'ส่งข้อมูลเรียบร้อย',
        `ค่าใช้จ่าย ${payload.detail} ฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        'success'
      );

      if (document.getElementById('fe-dashboard')?.classList.contains('active')) {
        await loadFamilyExpensesDashboard(true);
      }
    } catch (error) {
      console.error('Family Expenses Save Error:', error);
      await showFormError('บันทึกไม่สำเร็จ', error.message || 'กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
    } finally {
      showLoading(false);
      setButtonBusy(submitButton, false);
    }
  });
}

function feEscapeHtml(value) {
  return BelovedUtils.escapeHtml(value);
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
  const text = String(dateText || '').trim();
  const thaiDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thaiDate) {
    let year = Number(thaiDate[3]);
    if (year > 2400) year -= 543;
    return new Date(year, Number(thaiDate[2]) - 1, Number(thaiDate[1])).getTime();
  }
  const parsed = BelovedUtils.parseDateValue(text);
  return parsed ?? 0;
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

    const fail = error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timeoutId = setTimeout(() => fail(new Error('โหลดข้อมูล Sheet ใช้เวลานานเกินกำหนด')), 8000);

    window[callbackName] = response => {
      if (settled) return;
      settled = true;
      cleanup();

      if (!response || response.status === 'error') {
        reject(new Error(response?.errors?.[0]?.detailed_message || 'ไม่สามารถอ่านรายการจาก Sheet ได้'));
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
      }).filter(transaction => transaction.date && transaction.amount > 0);

      transactions.sort((a, b) => feParseDateValue(b.date) - feParseDateValue(a.date));
      resolve(transactions);
    };

    script.onerror = () => fail(new Error('ไม่สามารถโหลดข้อมูล Sheet ได้'));
    script.src = `https://docs.google.com/spreadsheets/d/${FE_SHEET_ID}/gviz/tq?gid=${FE_SHEET_GID}&headers=1&tqx=responseHandler:${callbackName}&tq=${query}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function loadFamilyExpensesApiSummary() {
  const response = await BelovedUtils.fetchWithTimeout(`${FE_SCRIPT_URL}?_=${Date.now()}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getSummary' })
  }, FE_REQUEST_TIMEOUT_MS);

  if (!response.ok) throw new Error(`Family Expenses API ตอบกลับ ${response.status}`);
  const data = await response.json();
  if (data.result !== 'success') throw new Error(data.error || 'ไม่สามารถอ่านสรุปจาก API ได้');

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

  transactions.forEach(transaction => {
    const amount = feParseAmount(transaction.amount);
    const category = transaction.category || 'ไม่ระบุประเภท';
    totalAmount += amount;
    categories[category] = (categories[category] || 0) + amount;
  });

  return { totalAmount, categories, transactions, source };
}

function feFormatFilterLabel(startValue, endValue) {
  const format = value => new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  if (startValue && endValue) return `${format(startValue)} – ${format(endValue)}`;
  if (startValue) return `ตั้งแต่ ${format(startValue)}`;
  if (endValue) return `ถึง ${format(endValue)}`;
  return 'ทั้งหมด';
}

function getFilteredFamilyExpensesData(data) {
  const startValue = document.getElementById('feStartDate')?.value || '';
  const endValue = document.getElementById('feEndDate')?.value || '';
  if (!startValue && !endValue) {
    return { ...data, transactions: [...(data.transactions || [])], filterLabel: 'ทั้งหมด' };
  }

  const transactions = BelovedUtils.filterByDateRange(
    data.transactions || [],
    startValue,
    endValue,
    transaction => {
      const time = feParseDateValue(transaction.date);
      return time ? new Date(time).toISOString() : '';
    }
  );

  const summary = buildFamilyExpensesSummary(transactions, data.source);
  summary.monthName = data.monthName;
  summary.filterLabel = feFormatFilterLabel(startValue, endValue);
  return summary;
}

function renderFamilyExpensesDashboardData(rawData) {
  feCurrentDashboardData = rawData;
  const data = getFilteredFamilyExpensesData(rawData);
  const transactions = data.transactions || [];
  const categories = data.categories || {};
  const labels = Object.keys(categories);
  const values = Object.values(categories);
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8A2BE2', '#00FA9A'];
  const sourceLabel = data.filterLabel !== 'ทั้งหมด'
    ? data.filterLabel
    : (data.source === 'api-monthly' ? (data.monthName || 'รายเดือน') : 'ทั้งหมดใน Sheet');

  document.getElementById('feMonthName').innerText = sourceLabel;
  document.getElementById('feTotalAmount').innerText = (data.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

  const updatedAt = document.getElementById('feLastUpdated');
  if (updatedAt) {
    updatedAt.innerText = `อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
  }

  const filterSummary = document.getElementById('feFilterSummary');
  if (filterSummary) filterSummary.innerText = `${data.filterLabel} · ${transactions.length.toLocaleString('th-TH')} รายการ`;

  document.getElementById('feCategoryList').innerHTML = labels.map((category, index) => {
    const value = values[index] || 0;
    return `
      <div class="list-item">
        <div>
          <span class="dot-indicator" style="background-color: ${colors[index % colors.length]}; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px;"></span>
          ${feEscapeHtml(category)}
        </div>
        <div class="fw-bold">฿${value.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
      </div>
    `;
  }).join('') || '<div class="text-center text-muted p-4">ไม่มีข้อมูลแยกตามประเภท</div>';

  const displayLimit = Math.max(1, Number(document.getElementById('feTransactionLimit')?.value) || 50);
  const visibleTransactions = transactions.slice(0, displayLimit);
  const transactionHtml = visibleTransactions.map(transaction => {
    const remark = transaction.remark ? ` | ${feEscapeHtml(transaction.remark)}` : '';
    const amount = feParseAmount(transaction.amount);

    return `
      <div class="list-item">
        <div>
          <div class="list-item-title">${feEscapeHtml(transaction.detail || 'ไม่ระบุรายละเอียด')}</div>
          <div class="list-item-subtitle mt-1">
            <span class="list-item-tag">${feEscapeHtml(transaction.category || '')}</span>
            ${feEscapeHtml(transaction.date || '')}${remark}
          </div>
        </div>
        <div class="list-item-amount text-danger">-฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
      </div>
    `;
  }).join('');

  const moreCount = transactions.length - visibleTransactions.length;
  document.getElementById('feTransactionList').innerHTML = transactionHtml
    + (moreCount > 0 ? `<div class="text-center text-muted p-4">ยังมีอีก ${moreCount.toLocaleString('th-TH')} รายการ กรุณาปรับจำนวนรายการด้านบน</div>` : '')
    || '<div class="text-center text-muted p-4">ไม่มีรายการค่าใช้จ่ายในช่วงที่เลือก</div>';

  const canvas = document.getElementById('feChart');
  if (feChartInstance) feChartInstance.destroy();

  feChartInstance = new Chart(canvas.getContext('2d'), {
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
  if (feDashboardLoading) return false;
  if (feDataLoaded && !forceRefresh && feCurrentDashboardData) {
    renderFamilyExpensesDashboardData(feCurrentDashboardData);
    return true;
  }

  feDashboardLoading = true;
  document.getElementById('feDashboardContent').style.display = 'none';
  const loading = document.getElementById('feDashboardLoading');
  loading.style.display = 'block';
  loading.innerHTML = '<div class="spinner"></div><p>กำลังดึงข้อมูลสดจาก Sheet...</p>';

  const refreshButtons = [
    document.getElementById('feRefreshDashboard'),
    document.getElementById('feHeaderRefresh')
  ].filter(Boolean);
  refreshButtons.forEach(button => { button.disabled = true; });

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
    return true;
  } catch (error) {
    loading.innerHTML = `<p class="text-danger">โหลดข้อมูลไม่สำเร็จ: ${feEscapeHtml(error.message)}</p>`;
    return false;
  } finally {
    feDashboardLoading = false;
    refreshButtons.forEach(button => { button.disabled = false; });
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

document.getElementById('feRefreshDashboard')?.addEventListener('click', () => loadFamilyExpensesDashboard(true));

document.getElementById('feApplyDateFilter')?.addEventListener('click', async () => {
  if (!feCurrentDashboardData) return;
  try {
    renderFamilyExpensesDashboardData(feCurrentDashboardData);
  } catch (error) {
    await showFormError('ช่วงเวลาไม่ถูกต้อง', error.message);
  }
});

document.getElementById('feClearDateFilter')?.addEventListener('click', () => {
  document.getElementById('feStartDate').value = '';
  document.getElementById('feEndDate').value = '';
  if (feCurrentDashboardData) renderFamilyExpensesDashboardData(feCurrentDashboardData);
});

document.getElementById('feTransactionLimit')?.addEventListener('change', () => {
  if (feCurrentDashboardData) renderFamilyExpensesDashboardData(feCurrentDashboardData);
});
