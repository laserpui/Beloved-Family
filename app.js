// Main App Logic for Navigation and Utility
const globalLoading = document.getElementById('globalLoading');
const ADMIN_PASSWORD = 'Admin1234';
const protectedPages = {
  'mona-expenses': 'monaUnlocked'
};

// Navigation Logic
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    e.preventDefault();
    const targetId = item.getAttribute('data-target');
    
    const unlockKey = protectedPages[targetId];

    // Password protection for private sections
    if (unlockKey && sessionStorage.getItem(unlockKey) !== 'true') {
      const { value: password } = await Swal.fire({
        title: '🔒 ยืนยันตัวตน',
        input: 'password',
        inputPlaceholder: 'กรอกรหัสผ่านเพื่อเข้าใช้งาน',
        showCancelButton: true,
        confirmButtonText: 'เข้าสู่ระบบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: 'var(--primary-color)',
        customClass: {
          popup: 'glass-panel'
        }
      });

      if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(unlockKey, 'true');
        Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          timer: 1000,
          showConfirmButton: false,
          customClass: { popup: 'glass-panel' }
        });
      } else {
        if (password !== undefined) {
          Swal.fire({
            icon: 'error',
            title: 'รหัสผ่านไม่ถูกต้อง',
            text: 'คุณไม่สามารถเข้าถึงหน้านี้ได้',
            customClass: { popup: 'glass-panel' }
          });
        }
        return; // Stop navigation
      }
    }
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    // Update active section
    document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
  });
});

const familyExpensesSheetLink = document.getElementById('familyExpensesSheetLink');
if (familyExpensesSheetLink) {
  familyExpensesSheetLink.addEventListener('click', async (e) => {
    e.preventDefault();

    const { value: password } = await Swal.fire({
      title: '🔐 ยืนยันตัวตน',
      input: 'password',
      inputPlaceholder: 'กรอกรหัสผ่านเพื่อเข้าใช้งาน',
      showCancelButton: true,
      confirmButtonText: 'เข้าสู่ระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: 'var(--primary-color)',
      customClass: {
        popup: 'glass-panel'
      }
    });

    if (password === ADMIN_PASSWORD) {
      window.open(familyExpensesSheetLink.href, '_blank', 'noopener,noreferrer');
      return;
    }

    if (password !== undefined) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านไม่ถูกต้อง',
        text: 'ไม่สามารถเปิด Google Sheet ได้',
        customClass: { popup: 'glass-panel' }
      });
    }
  });
}

// Tab Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-tab');
    const container = btn.closest('.tabs-container');
    
    // Update active tab button
    container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update active tab content
    container.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    // Trigger resize for charts if they are in the target tab
    if(targetId === 'fe-dashboard' && typeof feChartInstance !== 'undefined') {
      setTimeout(() => feChartInstance.resize(), 100);
      if(!feDataLoaded) loadFamilyExpensesDashboard();
    }
    if(targetId === 'me-dashboard' && !meDataLoaded) {
      loadMonaExpensesDashboard();
    }
    if(targetId === 'ks-individual-dashboard') {
      renderKidsSavingsDashboard();
    }
  });
});

// Utility Functions
function showLoading(show = true) {
  globalLoading.style.display = show ? 'flex' : 'none';
}

function showToast(title, text, icon = 'success') {
  Swal.fire({
    icon: icon,
    title: title,
    text: text,
    timer: 2000,
    showConfirmButton: false,
    background: 'rgba(255,255,255,0.95)',
    backdrop: `rgba(0,0,0,0.4)`,
    customClass: {
      popup: 'glass-panel'
    }
  });
}

// Convert Base64 Helper
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
