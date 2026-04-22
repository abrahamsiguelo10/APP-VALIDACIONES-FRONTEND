
const NAV = [
  { section: 'Principal', items: [
    { id: 'dashboard', label: 'Dashboard', roles: ['admin','user'],
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>` },
    { id: 'validador', label: 'Validador', roles: ['admin','user'],
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` },
  ]},
  { section: 'Administración', roles: ['admin'], items: [
    { id: 'admin', label: 'Patentes / IMEI', roles: ['admin'],
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>` },
    /* ── CAMBIO 1: nuevo item Clientes ── */
    { id: 'gestion_clientes', label: 'Clientes', roles: ['admin'],
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
    { id: 'settings', label: 'Configuración', roles: ['admin'],
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` },
  ]},
];

/* ═══════════════════════════════════════════════════════════════
   BUILD SIDEBAR NAV
═══════════════════════════════════════════════════════════════ */
function buildNav() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  const { role, role_id } = state.user;
  let allowedModules = null;
  if (role_id && role !== 'admin') {
    const customRole = ROLES.find(r => r.id === role_id);
    if (customRole) allowedModules = customRole.modules;
  }
  NAV.forEach(section => {
    if (section.roles && !section.roles.includes(role)) {
      if (role !== 'admin') return;
    }
    const visibleItems = section.items.filter(item => {
      if (role === 'admin') return true;
      if (allowedModules) return allowedModules.includes(item.id);
      return item.roles.includes(role);
    });
    if (!visibleItems.length) return;
    const lbl = document.createElement('div');
    lbl.className = 'nav-section-label';
    lbl.textContent = section.section;
    nav.appendChild(lbl);
    visibleItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.view = item.id;
      el.innerHTML = `
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      `;
      el.addEventListener('click', () => {
        if (typeof closeClienteForm === 'function') closeClienteForm();
        navigate(item.id);
        closeSidebar();
      });
      nav.appendChild(el);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════ */

/* ── CAMBIO 2: gestion_clientes en VIEW_TITLES ── */
const VIEW_TITLES = {
  dashboard:         'Dashboard',
  validador:         'Validador de Unidades',
  admin:             'Admin Patentes / IMEI',
  gestion_clientes:  'Gestión de Clientes',   // ← nuevo
  settings:          'Configuración',
};

function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.stab-panel').forEach(p => p.style.display = 'none');

  const target = document.getElementById('view-' + viewId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewId);
  });

  const title = VIEW_TITLES[viewId] || viewId;
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('breadcrumb-current').textContent = title;
  state.currentView = viewId;

  if (viewId === 'settings') {
    switchSettingsTab('general');
  }
  if (viewId === 'admin' && !_adminUnits.length) {
    setTimeout(() => renderAdminTable(), 0);
  }
  if (viewId === 'dashboard') {
    setTimeout(() => loadDashboard(), 0);
  }
  /* ── CAMBIO 3: hook de carga ── */
  if (viewId === 'gestion_clientes') {
    setTimeout(() => renderGestionClientes(), 0);
  }
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.stab-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('stab-' + tab);
  if (panel) panel.style.display = tab === 'general' ? 'grid' : 'block';
  if (tab === 'general')      initGeneralTab();
  if (tab === 'usuarios')     loadUsers();
  if (tab === 'orgs')         renderOrgList();
  if (tab === 'roles')        renderRolesTable();
  if (tab === 'certificados') loadCertificados();
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE SIDEBAR
═══════════════════════════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}
