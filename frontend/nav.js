(function () {
  const host = document.getElementById('appNav');
  if (!host) return;
  if (!requireAuth()) return;

  const links = [
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'meal-logging.html', label: 'Log meals' },
    { href: 'reports.html', label: 'Reports' },
  ];

  function withSelectedDate(href) {
    // Keep navigation "...html?date=YYYY-MM-DD" consistent with the dashboard date picker.
    // (If storage is unavailable or date isn't set, we just return the plain href.)
    try {
      const d = localStorage.getItem('selectedDate');
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return href;
      const u = new URL(href, location.href);
      u.searchParams.set('date', d);
      return u.pathname.split('/').pop() + '?' + u.searchParams.toString();
    } catch {
      return href;
    }
  }

  const current = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();

  const navLinks = links
    .map((l) => {
      const isActive = current === l.href.toLowerCase();
      const href = (l.href === 'dashboard.html' || l.href === 'meal-logging.html') ? withSelectedDate(l.href) : l.href;
      return `<a class="nav-btn ${isActive ? 'active' : ''}" href="${href}">${l.label}</a>`;
    })
    .join('');

  host.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="app-badge" aria-hidden="true">🥗</div>
        <div>
          <div class="sidebar-title">NutriTracker</div>
          <div class="sidebar-subtitle">Nutrition made simple</div>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="Primary">
        ${navLinks}
      </nav>

      <div class="sidebar-footer">
        <button class="nav-btn nav-logout" id="navLogoutBtn" type="button">
          <span aria-hidden="true">⎋</span>
          <span>Log out</span>
        </button>

        <a class="nav-btn nav-settings ${current === 'settings.html' ? 'active' : ''}" href="settings.html">
          <span aria-hidden="true">⚙</span>
          <span>Settings</span>
        </a>
      </div>
    </div>
  `;

  document.getElementById('navLogoutBtn')?.addEventListener('click', logout);
})();
