// Main App Logic for Navigation, access prompts, refresh actions and utilities
if (!globalThis.BelovedUtils) throw new Error('core-utils.js must load before app.js');

const globalLoading = document.getElementById('globalLoading');
const globalLoadingText = document.getElementById('globalLoadingText');

// This is only a client-side convenience gate. Real access control must stay in Google permissions/backend.
const ADMIN_PASSWORD = 'Admin1234';
const protectedPages = {
  'mona-expenses': 'monaUnlocked'
};

async function requestAdminAccess(sessionKey, title = 'ยืนยันตัวตน') {
  if (sessionStorage.getItem(sessionKey) === 'true') return true;

  const { value: password, isDismissed } = await Swal.fire({
    title: `🔐 ${title}`,
    text: 'พื้นที่นี้สำหรับผู้ดูแลครอบครัว',
    input: 'password',
    inputPlaceholder: 'กรอกรหัสผ่าน',
    inputAttributes: {
      autocomplete: 'current-password',
      autocapitalize: 'off',
      spellcheck: 'false'
    },
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-lock-open"></i> เปิดใช้งาน',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
    focusConfirm: false,
    customClass: {
      popup: 'beloved-popup',
      confirmButton: 'swal-btn swal-btn-primary',
      cancelButton: 'swal-btn swal-btn-secondary'
    },
    buttonsStyling: false
  });

  if (isDismissed || password === undefined) return false;

  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem(sessionKey, 'true');
    showToast('ยืนยันตัวตนสำเร็จ', 'สามารถเปิดใช้งานส่วนนี้ได้แล้ว', 'success');
    return true;
  }

  await showFormError('รหัสผ่านไม่ถูกต้อง', 'กรุณาตรวจสอบรหัสผ่านแล้วลองอีกครั้ง');
  return false;
}

async function activatePage(targetId) {
  const unlockKey = protectedPages[targetId];
  if (unlockKey && !(await requestAdminAccess(unlockKey, 'ยืนยันก่อนเข้าใช้งาน'))) return false;

  document.querySelectorAll('.nav-item').forEach(nav => {
    const isActive = nav.dataset.target === targetId;
    nav.classList.toggle('active', isActive);
    nav.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.toggle('active', section.id === targetId);
  });

  if (targetId !== 'family-expenses' && typeof stopFamilyExpensesAutoRefresh === 'function') {
    stopFamilyExpensesAutoRefresh();
  }
  return true;
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', event => {
    event.preventDefault();
    activatePage(item.dataset.target);
  });
});

document.querySelectorAll('[data-navigate]').forEach(card => {
  const openTarget = () => activatePage(card.dataset.navigate);
  card.addEventListener('click', openTarget);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTarget();
    }
  });
});

const protectedSheetLinks = [
  { id: 'familyExpensesSheetLink', sessionKey: 'familySheetUnlocked', title: 'เปิด Family Expenses Sheet' },
  { id: 'kidsSavingsSheetLink', sessionKey: 'kidsSheetUnlocked', title: 'เปิด Kids Savings Sheet' },
  { id: 'monaExpensesSheetLink', sessionKey: 'monaUnlocked', title: 'เปิด Mona Gym Sheet' }
];

protectedSheetLinks.forEach(({ id, sessionKey, title }) => {
  const link = document.getElementById(id);
  if (!link) return;

  link.addEventListener('click', async event => {
    event.preventDefault();
    if (await requestAdminAccess(sessionKey, title)) {
      const sheetUrl = link.dataset.sheetUrl;
      if (sheetUrl) window.open(sheetUrl, '_blank', 'noopener,noreferrer');
    }
  });
});

document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.tab;
    const container = button.closest('.tabs-container');
    if (!container) return;

    container.querySelectorAll('.tab-btn').forEach(tab => {
      const isActive = tab === button;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    container.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === targetId);
    });

    if (targetId === 'fe-dashboard' && typeof loadFamilyExpensesDashboard === 'function') {
      feDataLoaded = false;
      loadFamilyExpensesDashboard(true);
      if (typeof startFamilyExpensesAutoRefresh === 'function') startFamilyExpensesAutoRefresh();
    } else if (typeof stopFamilyExpensesAutoRefresh === 'function') {
      stopFamilyExpensesAutoRefresh();
    }

    if (targetId === 'me-dashboard' && typeof loadMonaExpensesDashboard === 'function') {
      loadMonaExpensesDashboard(!meDataLoaded);
    }

    if (targetId === 'ks-individual-dashboard' && typeof renderKidsSavingsDashboard === 'function') {
      renderKidsSavingsDashboard();
    }
  });
});


document.getElementById('feHeaderRefresh')?.addEventListener('click', async () => {
  if (typeof loadFamilyExpensesDashboard !== 'function') return;
  const refreshed = await loadFamilyExpensesDashboard(true);
  if (refreshed) showToast('อัปเดตแล้ว', 'โหลดข้อมูล Family Expenses ล่าสุดเรียบร้อย', 'success');
});


function showLoading(show = true, message = 'กำลังประมวลผล...') {
  if (!globalLoading) return;
  if (globalLoadingText) globalLoadingText.textContent = message;
  globalLoading.style.display = show ? 'flex' : 'none';
  globalLoading.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function setButtonBusy(button, busy, busyLabel = 'กำลังบันทึก...') {
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-2"></i>${escapeHtml(busyLabel)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    delete button.dataset.originalHtml;
  }
}

function showToast(title, text, icon = 'success') {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    text,
    timer: 3200,
    timerProgressBar: true,
    showConfirmButton: false,
    showCloseButton: true,
    background: 'rgba(255,255,255,0.98)',
    customClass: { popup: 'beloved-toast' },
    didOpen: toast => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
}

function showFormError(title, text) {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'ตกลง',
    customClass: {
      popup: 'beloved-popup',
      confirmButton: 'swal-btn swal-btn-primary'
    },
    buttonsStyling: false
  });
}

function escapeHtml(value) {
  return BelovedUtils.escapeHtml(value);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
