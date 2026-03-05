/**
 * auth.js — Login, logout y restaurar sesión
 * Depende de: config.js, api.js, store.js, nav.js
 */

/* ── Login ────────────────────────────────────────────────────── */
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const err      = document.getElementById('login-error');
  const btn      = document.querySelector('.btn-login');

  err.classList.remove('show');

  if (!username || !password) {
    err.textContent = 'Ingresa usuario y contraseña.';
    err.classList.add('show');
    return;
  }

  // Estado de carga
  btn.textContent = 'Ingresando...';
  btn.disabled    = true;

  try {
    const data = await api.post('/auth/login', { username, password });

    // Guardar token y usuario en sessionStorage
    setToken(data.token);
    setSessionUser(data.user);

    enterApp(data.user);

  } catch (e) {
    // api.js ya mostró el toast, aquí solo mostrar en el form
    const msg = e.message === 'Unauthorized' || e.message?.includes('incorrectos')
      ? 'Usuario o contraseña incorrectos.'
      : e.message?.includes('deshabilitad')
        ? 'Tu cuenta está deshabilitada. Contacta al administrador.'
        : 'No se pudo conectar con el servidor.';

    err.textContent = msg;
    err.classList.add('show');
  } finally {
    btn.textContent = 'Ingresar';
    btn.disabled    = false;
  }
}

/* ── Logout ───────────────────────────────────────────────────── */
async function doLogout() {
  // Notificar al backend (para audit_log) — no bloquear si falla
  try { await api.post('/auth/logout', {}); } catch (_) {}

  clearSession();
  state.user = null;

  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').classList.remove('show');
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
  document.getElementById('sidebar-role').textContent     = state.user.label;
  document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();

  buildNav();

  if (user.role === 'admin') {
    const kpiCard = document.getElementById('kpi-admin-card');
    if (kpiCard) kpiCard.style.display = '';
  }

  document.getElementById('welcome-msg').textContent = `Bienvenido, ${user.username}`;
  navigate('dashboard');
}

/* ── Restaurar sesión al cargar la página ────────────────────── */
function restoreSession() {
  const token = getToken();
  const user  = getSessionUser();

  if (token && user) {
    enterApp(user);
  }
  // Si no hay sesión, la pantalla de login ya está visible por defecto
}

/* ── Event listeners ──────────────────────────────────────────── */
document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('login-user').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
