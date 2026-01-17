(function () {
  const host = document.getElementById('appNav');
  if (!host) return;
  if (!requireAuth()) return;

  const links = [
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'meal-logging.html', label: 'Log meals' },
    { href: 'diet-planner.html', label: 'Diet planner' },
    { href: 'reports.html', label: 'Reports' },
    { href: 'admin.html', label: 'Admin' }
  ];

  const current = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();

  const navLinks = links
    .map((l) => {
      const isActive = current === l.href.toLowerCase();
      return `<a class="nav-btn ${isActive ? 'active' : ''}" href="${l.href}">${l.label}</a>`;
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
        <a class="nav-btn nav-settings ${current === 'settings.html' ? 'active' : ''}" href="settings.html">
          <span aria-hidden="true">⚙</span>
          <span>Settings</span>
        </a>
      </div>
    </div>
  `;
})();
