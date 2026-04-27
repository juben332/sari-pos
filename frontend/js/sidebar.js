// Call this on every page after DOM is ready
function initSidebar(activePage) {
  fillUserInfo();
  showAdminNav();

  // Mark active link
  document.querySelectorAll('.sidebar__link').forEach(link => {
    if (link.dataset.page === activePage) link.classList.add('active');
  });

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
}
