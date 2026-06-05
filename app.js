// Main App Logic for Navigation and Utility
const globalLoading = document.getElementById('globalLoading');

// Navigation Logic
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = item.getAttribute('data-target');
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    // Update active section
    document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
  });
});

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
