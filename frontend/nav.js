(function () {
  const host = document.getElementById('appNav');
  if (!host) return;
  if (!requireAuth()) return;

  const links = [
    { href: 'dashboard.html', label: 'Dashboard', dateAware: true },
    { href: 'meal-logging.html', label: 'Log meals', dateAware: true },
    { href: 'reports.html', label: 'Reports', dateAware: false },
  ];

  function getSelectedDate() {
    try {
      const d = localStorage.getItem('selectedDate');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(String(d))) return String(d);
    } catch {
      // ignore
    }
    return null;
  }

  function withSelectedDate(href) {
    const d = getSelectedDate();
    if (!d) return href;
    const u = new URL(href, window.location.href);
    u.searchParams.set('date', d);
    // keep relative
    return u.pathname.split('/').pop() + '?' + u.searchParams.toString();
  }

  const current = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();

  const navLinks = links
    .map((l) => {
      const isActive = current === l.href.toLowerCase();

      // Keep the original sidebar/nav structure + classes (style.css relies on these),
      // but compute date-aware destinations at click time so changes apply immediately.
      if (l.dateAware) {
        return `<a class="nav-btn ${isActive ? 'active' : ''}" href="${l.href}" data-date-aware="1" data-base-href="${l.href}">${l.label}</a>`;
      }
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

  // Date-aware navigation: compute destination using the latest selectedDate on click.
  host.querySelectorAll('a[data-date-aware="1"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      // allow new-tab/window and modified clicks
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const baseHref = a.getAttribute('data-base-href') || a.getAttribute('href') || '';
      const dest = withSelectedDate(baseHref);
      if (dest && dest !== baseHref) {
        e.preventDefault();
        window.location.href = dest;
      }
    });
  });

  document.getElementById('navLogoutBtn')?.addEventListener('click', logout);
})();
