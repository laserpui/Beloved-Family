// Mona Expenses Logic
const ME_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWIlacxe3-mH2G-TKtNrlWOWAdEiiIfM2jIcsblmN_u2IK7o-X3fLhU-4SjMhnMmNWKw/exec';
const ME_REQUEST_TIMEOUT_MS = 15000;
let meDataLoaded = false;
let meDashboardLoading = false;
let meAllData = [];
let meChartInstance = null;

document.getElementById('meDate').value = BelovedUtils.getLocalDateInputValue();

function meCheckCustomType(select) {
  const group = document.getElementById('meCustomTypeGroup');
  const input = document.getElementById('meCustomType');
  const isCustom = select.value === 'อื่นๆ';
  group.style.display = isCustom ? 'block' : 'none';
  input.toggleAttribute('required', isCustom);
  if (!isCustom) input.value = '';
}

async function meFetchData() {
  const response = await BelovedUtils.fetchWithTimeout(
    `${ME_SCRIPT_URL}?_=${Date.now()}`,
    { cache: 'no-store' },
    ME_REQUEST_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Mona Gym API ตอบกลับ ${response.status}`);
  const result = await response.json();
  if (!result?.success) throw new Error(result?.error || 'ระบบไม่ส่งข้อมูลกลับมา');
  return Array.isArray(result.data) ? result.data : [];
}

function meMatchesPayload(item, payload) {
  return String(item.date || '').slice(0, 10) === payload.date
    && String(item.type || '') === payload.type
    && Math.abs((Number(item.amount) || 0) - payload.amount) < 0.001
    && String(item.notes || '') === payload.notes;
}

async function meConfirmSavedTransaction(payload, baselineCount) {
  for (const waitMs of [800, 1600, 2600]) {
    await BelovedUtils.delay(waitMs);
    try {
      const latestData = await meFetchData();
      const matchingCount = latestData.filter(item => meMatchesPayload(item, payload)).length;
      if (matchingCount > baselineCount) {
        meAllData = latestData;
        meDataLoaded = true;
        return true;
      }
    } catch (error) {
      console.warn('Mona confirmation read failed:', error.message);
    }
  }
  return false;
}

document.getElementById('meCategory')?.addEventListener('change', event => meCheckCustomType(event.target));

document.getElementById('meForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const category = document.getElementById('meCategory').value;
  const type = category === 'อื่นๆ'
    ? document.getElementById('meCustomType').value.trim()
    : category;
  const amount = BelovedUtils.validatePositiveAmount(document.getElementById('meAmount').value);

  if (!type) {
    await showFormError('ข้อมูลไม่ครบ', 'กรุณาระบุประเภทค่าใช้จ่าย');
    return;
  }
  if (amount === null) {
    await showFormError('จำนวนเงินไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินที่มากกว่า 0 บาท');
    return;
  }

  const payload = {
    date: document.getElementById('meDate').value,
    type,
    rawType: category,
    amount,
    notes: document.getElementById('meRemark').value.trim()
  };
  const file = document.getElementById('meFile').files[0];
  const submitButton = document.getElementById('meSubmitButton');

  setButtonBusy(submitButton, true);
  showLoading(true, 'กำลังบันทึกค่าใช้จ่าย Mona Gym...');

  try {
    if (file) {
      if (file.size > 10 * 1024 * 1024) throw new Error('ไฟล์แนบต้องมีขนาดไม่เกิน 10MB');
      payload.fileData = (await fileToBase64(file)).split(',')[1];
      payload.fileName = file.name;
      payload.fileMimeType = file.type;
    }

    let baselineData = meAllData;
    try {
      baselineData = await meFetchData();
    } catch (error) {
      console.warn('Unable to read Mona baseline before save:', error.message);
    }
    const baselineCount = baselineData.filter(item => meMatchesPayload(item, payload)).length;

    await BelovedUtils.fetchWithTimeout(ME_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }, ME_REQUEST_TIMEOUT_MS);

    showLoading(true, 'ส่งข้อมูลแล้ว กำลังตรวจสอบผลการบันทึก...');
    const confirmed = await meConfirmSavedTransaction(payload, baselineCount);

    if (!confirmed) {
      await Swal.fire({
        icon: 'warning',
        title: 'ส่งคำขอแล้ว แต่ยังยืนยันไม่ได้',
        text: 'ระบบยังไม่พบรายการใหม่ในข้อมูลที่อ่านกลับมา กรุณากด Refresh ก่อนส่งซ้ำเพื่อป้องกันรายการซ้ำ',
        confirmButtonText: 'รับทราบ',
        customClass: { popup: 'beloved-popup', confirmButton: 'swal-btn swal-btn-primary' },
        buttonsStyling: false
      });
      meDataLoaded = false;
      return;
    }

    document.getElementById('meForm').reset();
    document.getElementById('meDate').value = BelovedUtils.getLocalDateInputValue();
    document.getElementById('meCustomTypeGroup').style.display = 'none';

    showToast(
      'บันทึกและตรวจสอบสำเร็จ',
      `ค่าใช้จ่าย ${type} ฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
      'success'
    );

    if (document.getElementById('me-dashboard')?.classList.contains('active')) {
      renderMonaExpensesDashboard();
    }
  } catch (error) {
    console.error('Mona Expenses Save Error:', error);
    await showFormError('บันทึกไม่สำเร็จ', error.message || 'กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  } finally {
    showLoading(false);
    setButtonBusy(submitButton, false);
  }
});

function meFilterDataByDate(data) {
  return BelovedUtils.filterByDateRange(
    data,
    document.getElementById('meStartDate')?.value || '',
    document.getElementById('meEndDate')?.value || '',
    item => item.date
  );
}

function meFormatRangeLabel() {
  const startValue = document.getElementById('meStartDate')?.value || '';
  const endValue = document.getElementById('meEndDate')?.value || '';
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

function renderMonaExpensesDashboard() {
  const filteredData = meFilterDataByDate(meAllData);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let monthTotal = 0;
  let yearTotal = 0;
  let rangeTotal = 0;
  const breakdown = {};

  meAllData.forEach(item => {
    const itemDate = new Date(item.date);
    const amount = Number(item.amount) || 0;
    if (Number.isNaN(itemDate.getTime())) return;
    if (itemDate.getFullYear() === currentYear) {
      yearTotal += amount;
      if (itemDate.getMonth() === currentMonth) monthTotal += amount;
    }
  });

  filteredData.forEach(item => {
    const amount = Number(item.amount) || 0;
    const type = item.type || 'ไม่ระบุประเภท';
    rangeTotal += amount;
    breakdown[type] = (breakdown[type] || 0) + amount;
  });

  document.getElementById('meMonthTotal').innerText = `฿${monthTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  document.getElementById('meYearTotal').innerText = `฿${yearTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  document.getElementById('meRangeTotal').innerText = `฿${rangeTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  document.getElementById('meRangeLabel').innerText = `ยอดรวม: ${meFormatRangeLabel()}`;

  const labels = Object.keys(breakdown);
  const dataValues = Object.values(breakdown);
  const colors = ['#EC4899', '#8B5CF6', '#4F46E5', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#14B8A6', '#F43F5E'];
  const canvas = document.getElementById('meChart');

  if (meChartInstance) meChartInstance.destroy();
  meChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: dataValues,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { family: 'Outfit, Sarabun' }, usePointStyle: true }
        }
      }
    }
  });
  window.meChartInstance = meChartInstance;

  const transactionHtml = [...filteredData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 50)
    .map(item => {
      const amount = Number(item.amount) || 0;
      const notes = item.notes ? ` | ${escapeHtml(item.notes)}` : '';

      return `
        <div class="list-item">
          <div>
            <div class="list-item-title">${escapeHtml(item.type || 'ไม่ระบุประเภท')}</div>
            <div class="list-item-subtitle mt-1">${escapeHtml(item.date || '')}${notes}</div>
          </div>
          <div class="list-item-amount text-pink">฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
        </div>
      `;
    }).join('');

  document.getElementById('meTransactionList').innerHTML =
    transactionHtml || '<div class="text-center text-muted p-4">ไม่พบรายการในช่วงเวลาที่เลือก</div>';
}

async function loadMonaExpensesDashboard(forceRefresh = false) {
  if (meDashboardLoading) return false;
  if (meDataLoaded && !forceRefresh) {
    renderMonaExpensesDashboard();
    return true;
  }

  meDashboardLoading = true;
  const content = document.getElementById('meDashboardContent');
  const loading = document.getElementById('meDashboardLoading');
  const refreshButton = document.getElementById('meRefresh');

  content.style.display = 'none';
  loading.style.display = 'block';
  loading.innerHTML = '<div class="spinner border-pink"></div><p>กำลังดึงข้อมูลรายงาน...</p>';
  if (refreshButton) refreshButton.disabled = true;

  try {
    meAllData = await meFetchData();
    meDataLoaded = true;
    renderMonaExpensesDashboard();

    const updatedAt = document.getElementById('meLastUpdated');
    if (updatedAt) {
      updatedAt.innerText = `อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })}`;
    }

    loading.style.display = 'none';
    content.style.display = 'block';
    return true;
  } catch (error) {
    console.error('Mona Expenses Load Error:', error);
    loading.innerHTML = `<p class="text-danger">ไม่สามารถดึงข้อมูลได้: ${escapeHtml(error.message)}</p>`;
    return false;
  } finally {
    meDashboardLoading = false;
    if (refreshButton) refreshButton.disabled = false;
  }
}

document.getElementById('meApplyDateFilter')?.addEventListener('click', async () => {
  try {
    renderMonaExpensesDashboard();
  } catch (error) {
    await showFormError('ช่วงเวลาไม่ถูกต้อง', error.message);
  }
});

document.getElementById('meClearDateFilter')?.addEventListener('click', () => {
  document.getElementById('meStartDate').value = '';
  document.getElementById('meEndDate').value = '';
  renderMonaExpensesDashboard();
});

document.getElementById('meRefresh')?.addEventListener('click', async () => {
  const refreshed = await loadMonaExpensesDashboard(true);
  if (refreshed) showToast('อัปเดตแล้ว', 'โหลดข้อมูล Mona Gym ล่าสุดเรียบร้อย', 'success');
});
