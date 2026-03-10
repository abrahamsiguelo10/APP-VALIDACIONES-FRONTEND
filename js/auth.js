/**
 * auth.js — Login, logout y restaurar sesión
 * Depende de: config.js, api.js, store.js, nav.js
 */

/* ── Login ────────────────────────────────────────────────────── */
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  const btn = document.getElementById('btn-login-submit') || document.querySelector('.btn-login');

  err.classList.remove('show');
  err.style.display = 'none';

  if (!username || !password) {
    err.textContent = 'Ingresa usuario y contraseña.';
    err.classList.add('show');
    err.style.display = '';
    return;
  }

  btn.textContent = 'Ingresando...';
  btn.disabled = true;

  try {
    const data = await api.post('/auth/login', { username, password });
    setToken(data.token);
    setSessionUser(data.user);
    enterApp(data.user);
  } catch (e) {
    const msg = e.message === 'Unauthorized' || e.message?.includes('incorrectos')
      ? 'Usuario o contraseña incorrectos.'
      : e.message?.includes('deshabilitad')
        ? 'Tu cuenta está deshabilitada. Contacta al administrador.'
        : 'No se pudo conectar con el servidor.';
    err.textContent = msg;
    err.classList.add('show');
    err.style.display = '';
  } finally {
    btn.textContent = 'Iniciar sesión';
    btn.disabled = false;
  }
}

/* ── Logout ───────────────────────────────────────────────────── */
async function doLogout() {
  try { await api.post('/auth/logout', {}); } catch (_) {}
  clearSession();
  state.user = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  const err = document.getElementById('login-error');
  err.classList.remove('show');
  err.style.display = 'none';
}

/* ── Entrar a la app ──────────────────────────────────────────── */
function enterApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').style.display = 'flex';
  state.user = {
    ...user,
    label: ROLE_LABELS[user.role] ?? user.role,
  };
  document.getElementById('sidebar-username').textContent = user.username;
  document.getElementById('sidebar-role').textContent = state.user.label;
  document.getElementById('sidebar-avatar').textContent = user.username[0].toUpperCase();
  buildNav();
  if (user.role === 'admin') {
    const kpiCard = document.getElementById('kpi-admin-card');
    if (kpiCard) kpiCard.style.display = '';
  }
  document.getElementById('welcome-msg').textContent = `Bienvenido, ${user.username}`;
  navigate('dashboard');
  // Aplicar configuración guardada (color, densidad, nombre plataforma)
  if (typeof _applyAllSavedConfig === 'function') _applyAllSavedConfig();
  // Aplicar nombre visible personalizado si existe
  const savedName = localStorage.getItem('sigeulo_display_name');
  if (savedName) {
    document.getElementById('sidebar-username').textContent = savedName;
    document.getElementById('welcome-msg').textContent = `Bienvenido, ${savedName}`;
  }
  // Aplicar logo personalizado si existe
  if (typeof _applySidebarLogo === 'function') setTimeout(_applySidebarLogo, 0);
}

/* ── Restaurar sesión al cargar la página ────────────────────── */
function restoreSession() {
  const token = getToken();
  const user  = getSessionUser();
  if (token && user) {
    enterApp(user);
  }
}

/* ── Event listeners ─────────────────────────────────────────── */
// Solo agrega listeners a campos que existen (admin)
// Los campos de cliente usan handleLogin() desde index.html
document.addEventListener('DOMContentLoaded', () => {
  const passAdmin = document.getElementById('login-pass');
  const userAdmin = document.getElementById('login-user');
  if (passAdmin) passAdmin.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin?.() || doLogin(); });
  if (userAdmin) userAdmin.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin?.() || doLogin(); });
});