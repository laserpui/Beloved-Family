// Kids Savings Logic
const KS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw03dmTKLEPprmYUmPhxpzzIzOxsPjiHgTdtVvHYYNx-1cO2x7f20QmpX0ofW16qnqm/exec';
const KS_REQUEST_TIMEOUT_MS = 12000;
const KS_ALLOW_LEGACY_GET_FALLBACK = true;
let currentKid = '';
let ksData = { namo: [], mona: [] };
let ksChartInstance = null;

function setKidsSavingsStatus(message, isError = false) {
  const status = document.getElementById('ksLastUpdated');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('text-danger', isError);
}

function normalizeKidsSavingsData(data) {
  return {
    namo: Array.isArray(data?.namo) ? data.namo : [],
    mona: Array.isArray(data?.mona) ? data.mona : []
  };
}

function calculateKidStats(transactions = []) {
  return { balance: BelovedUtils.calculateSavingsBalance(transactions) };
}

function updateKidsSavingsBalances() {
  const namoStats = calculateKidStats(ksData.namo);
  const monaStats = calculateKidStats(ksData.mona);

  document.getElementById('ksNamoBalance').innerText = namoStats.balance.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('ksMonaBalance').innerText = monaStats.balance.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  if (currentKid) {
    const selectedStats = calculateKidStats(ksData[currentKid.toLowerCase()]);
    document.getElementById('ksSelectedBalance').innerText = selectedStats.balance.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  }
}

async function ksLoadBalances() {
  const response = await BelovedUtils.fetchWithTimeout(
    `${KS_SCRIPT_URL}?action=read&_=${Date.now()}`,
    { cache: 'no-store' },
    KS_REQUEST_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Kids Savings API ตอบกลับ ${response.status}`);

  const result = await response.json();
  if (!result?.success) throw new Error(result?.error || 'ไม่สามารถอ่านข้อมูล Kids Savings ได้');

  ksData = normalizeKidsSavingsData(result.data);
  updateKidsSavingsBalances();
  setKidsSavingsStatus(`อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}`);
  return ksData;
}

async function ksRefreshData(showFeedback = true) {
  showLoading(true, 'กำลังโหลดข้อมูล Kids Savings ล่าสุด...');
  const refreshButton = document.getElementById('ksRefresh');
  if (refreshButton) refreshButton.disabled = true;

  try {
    await ksLoadBalances();
    if (currentKid && document.getElementById('ks-individual-dashboard')?.classList.contains('active')) {
      renderKidsSavingsDashboard();
    }
    if (showFeedback) showToast('อัปเดตแล้ว', 'โหลดข้อมูลเงินออมล่าสุดเรียบร้อย', 'success');
    return true;
  } catch (error) {
    console.error('Kids Savings Load Error:', error);
    setKidsSavingsStatus(`โหลดไม่สำเร็จ: ${error.message}`, true);
    if (showFeedback) await showFormError('รีเฟรชไม่สำเร็จ', error.message || 'ไม่สามารถโหลดข้อมูล Kids Savings ได้');
    return false;
  } finally {
    showLoading(false);
    if (refreshButton) refreshButton.disabled = false;
  }
}

ksLoadBalances().catch(error => {
  console.error('Kids Savings Load Error:', error);
  setKidsSavingsStatus(`โหลดไม่สำเร็จ: ${error.message}`, true);
});

document.querySelectorAll('[data-kid]').forEach(card => {
  const selectKid = () => ksSelectKid(card.dataset.kid);
  card.addEventListener('click', selectKid);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectKid();
    }
  });
});

function ksSelectKid(kid) {
  currentKid = kid === 'namo' ? 'Namo' : 'Mona';

  document.getElementById('ksPortal').style.display = 'none';
  document.getElementById('ksActionView').style.display = 'block';

  const selectedAvatar = document.getElementById('ksSelectedAvatar');
  selectedAvatar.src = kid === 'namo' ? 'Namo.png' : 'Mona.png';
  selectedAvatar.alt = kid === 'namo' ? 'รูปนโม' : 'รูปโมนา';
  document.getElementById('ksSelectedName').innerText = kid === 'namo' ? 'นโม (Namo)' : 'โมนา (Mona)';
  document.getElementById('ksDate').value = BelovedUtils.getLocalDateInputValue();

  updateKidsSavingsBalances();

  const container = document.getElementById('ksActionView').querySelector('.tabs-container');
  container.querySelectorAll('.tab-btn').forEach(button => button.classList.remove('active'));
  container.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  container.querySelector('.tab-btn[data-tab="ks-transaction"]').classList.add('active');
  document.getElementById('ks-transaction').classList.add('active');
}

function ksBackToPortal() {
  currentKid = '';
  document.getElementById('ksActionView').style.display = 'none';
  document.getElementById('ksPortal').style.display = 'grid';
  ksRefreshData(false);
}

async function parseKidsSavingsResponse(response) {
  if (!response.ok) throw new Error(`Kids Savings API ตอบกลับ ${response.status}`);
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    const unsupportedError = new Error('Kids Savings API ยังไม่รองรับ POST');
    unsupportedError.code = 'POST_UNSUPPORTED';
    throw unsupportedError;
  }
  if (!result?.success) throw new Error(result?.error || 'ระบบไม่ยืนยันการบันทึกข้อมูล');
  return result;
}

async function ksSaveTransaction(payload) {
  try {
    const postResponse = await BelovedUtils.fetchWithTimeout(KS_SCRIPT_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'add', ...payload })
    }, KS_REQUEST_TIMEOUT_MS);
    return await parseKidsSavingsResponse(postResponse);
  } catch (postError) {
    const canUseLegacyFallback = postError?.code === 'POST_UNSUPPORTED'
      || postError?.name === 'TypeError'
      || /Failed to fetch/i.test(postError?.message || '');
    if (!KS_ALLOW_LEGACY_GET_FALLBACK || !canUseLegacyFallback) throw postError;
    console.warn('Kids Savings POST unavailable; using legacy GET fallback:', postError.message);

    const requestUrl = `${KS_SCRIPT_URL}?action=add&sheetName=${encodeURIComponent(payload.sheetName)}&type=${encodeURIComponent(payload.type)}&description=${encodeURIComponent(payload.description)}&amount=${payload.amount}&date=${encodeURIComponent(payload.date)}&_=${Date.now()}`;
    const legacyResponse = await BelovedUtils.fetchWithTimeout(
      requestUrl,
      { cache: 'no-store' },
      KS_REQUEST_TIMEOUT_MS
    );
    return await parseKidsSavingsResponse(legacyResponse);
  }
}

async function ksSubmitTransaction(type, amountValue, detail, dateValue, formId) {
  const amount = BelovedUtils.validatePositiveAmount(amountValue);
  if (!currentKid) {
    await showFormError('ยังไม่ได้เลือกบัญชี', 'กรุณาเลือกนโมหรือโมนาก่อนทำรายการ');
    return;
  }
  if (amount === null) {
    await showFormError('จำนวนเงินไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินที่มากกว่า 0 บาท');
    return;
  }
  if (!dateValue) {
    await showFormError('วันที่ไม่ถูกต้อง', 'กรุณาระบุวันที่ทำรายการ');
    return;
  }

  const kidKey = currentKid.toLowerCase();
  const currentBalance = calculateKidStats(ksData[kidKey]).balance;
  if (type === 'ถอน' && amount > currentBalance) {
    await showFormError('ยอดเงินไม่เพียงพอ', `ยอดคงเหลือปัจจุบัน ฿${currentBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
    return;
  }

  const submitButton = document.getElementById('ksSubmitButton');
  setButtonBusy(submitButton, true);
  showLoading(true, 'กำลังบันทึกรายการเงินออม...');

  try {
    await ksSaveTransaction({
      sheetName: currentKid,
      type,
      description: detail,
      amount,
      date: dateValue
    });

    const form = document.getElementById(formId);
    form.reset();
    document.getElementById('ksDate').value = BelovedUtils.getLocalDateInputValue();

    ksData[kidKey].push({ type, amount, description: detail, date: dateValue });
    updateKidsSavingsBalances();
    setKidsSavingsStatus(`บันทึกล่าสุด: ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);

    showToast('บันทึกสำเร็จ', `${type}เงิน ฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ในบัญชี ${currentKid}`, 'success');
  } catch (error) {
    console.error('Kids Savings Save Error:', error);
    await showFormError('บันทึกไม่สำเร็จ', error.message || 'กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  } finally {
    showLoading(false);
    setButtonBusy(submitButton, false);
  }
}

document.getElementById('ksTransactionForm')?.addEventListener('submit', event => {
  event.preventDefault();
  ksSubmitTransaction(
    document.querySelector('input[name="ksType"]:checked')?.value,
    document.getElementById('ksAmount').value,
    document.getElementById('ksDetail').value.trim(),
    document.getElementById('ksDate').value,
    'ksTransactionForm'
  );
});

document.getElementById('ksRefresh')?.addEventListener('click', () => ksRefreshData(true));
document.getElementById('ksBackButton')?.addEventListener('click', ksBackToPortal);

function renderKidsSavingsDashboard() {
  if (!currentKid) return;

  const kidKey = currentKid.toLowerCase();
  const kidData = ksData[kidKey] || [];
  let totalDeposit = 0;
  let totalWithdraw = 0;
  const icon = kidKey === 'namo' ? '👦' : '👧';
  const kidNameThai = kidKey === 'namo' ? 'นโม' : 'โมนา';

  const transactions = kidData.map(transaction => {
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === 'ฝาก') totalDeposit += amount;
    if (transaction.type === 'ถอน') totalWithdraw += amount;
    return { ...transaction, amount, kid: kidNameThai, icon };
  });

  document.getElementById('ksDashTotalDeposit').innerText = `฿${totalDeposit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  document.getElementById('ksDashTotalWithdraw').innerText = `฿${totalWithdraw.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

  const recentTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  const transactionHtml = recentTransactions.map(transaction => {
    const isDeposit = transaction.type === 'ฝาก';
    const date = new Date(transaction.date);
    const dateText = Number.isNaN(date.getTime())
      ? escapeHtml(transaction.date)
      : date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return `
      <div class="list-item">
        <div class="d-flex align-center">
          <div class="transaction-icon me-2">${transaction.icon}</div>
          <div>
            <div class="list-item-title">${escapeHtml(transaction.kid)} - ${escapeHtml(transaction.type)}</div>
            <div class="list-item-subtitle mt-1">${dateText} | ${escapeHtml(transaction.description || transaction.detail || '')}</div>
          </div>
        </div>
        <div class="list-item-amount ${isDeposit ? 'text-success' : 'text-danger'}">
          ${isDeposit ? '+' : '-'}฿${transaction.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('ksTransactionList').innerHTML =
    transactionHtml || '<div class="text-center text-muted p-4">ไม่มีประวัติรายการ</div>';

  const canvas = document.getElementById('ksChart');
  if (!canvas) return;
  if (ksChartInstance) ksChartInstance.destroy();

  const monthsData = {};
  let cumulative = 0;
  [...kidData].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(transaction => {
    const amount = Number(transaction.amount) || 0;
    const date = new Date(transaction.date);
    if (Number.isNaN(date.getTime())) return;
    cumulative += transaction.type === 'ฝาก' ? amount : -amount;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthsData[monthKey] = cumulative;
  });

  const labels = Object.keys(monthsData).sort();
  const borderColor = kidKey === 'namo' ? '#36A2EB' : '#FF6384';
  const backgroundColor = kidKey === 'namo' ? 'rgba(54, 162, 235, 0.1)' : 'rgba(255, 99, 132, 0.1)';

  ksChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: kidNameThai,
        data: labels.map(month => monthsData[month]),
        borderColor,
        backgroundColor,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { font: { family: 'Sarabun' } } } }
    }
  });
}
