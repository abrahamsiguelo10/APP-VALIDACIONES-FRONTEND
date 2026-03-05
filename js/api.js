/**
 * api.js — Cliente HTTP centralizado
 *
 * Todas las llamadas al backend pasan por aquí.
 * Maneja automáticamente:
 *  - Adjuntar el token JWT en cada request
 *  - Redirigir al login si el servidor responde 401
 *  - Mostrar errores como toast
 */

/* ── Token helpers ────────────────────────────────────────────── */
function getToken()        { return sessionStorage.getItem('sgl_token'); }
function setToken(t)       { sessionStorage.setItem('sgl_token', t); }
function clearToken()      { sessionStorage.removeItem('sgl_token'); }
function getSessionUser()  {
  try { return JSON.parse(sessionStorage.getItem('sgl_user')); } catch { return null; }
}
function setSessionUser(u) { sessionStorage.setItem('sgl_user', JSON.stringify(u)); }
function clearSession()    { clearToken(); sessionStorage.removeItem('sgl_user'); }

/* ── Fetch con auth ───────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  let res;
  try {
    res = await fetch(CONFIG.API_URL + path, { ...options, headers });
  } catch (err) {
    // Error de red (Railway caído, sin internet, etc.)
    showToast('Sin conexión', 'No se pudo contactar el servidor. Verifica tu conexión.');
    throw err;
  }

  // Token expirado o usuario deshabilitado → forzar logout
// EXCEPCIÓN: no interceptar el 401 del login (lo maneja auth.js)
if (res.status === 401 && !path.includes('/auth/login')) {
  clearSession();
  showToast('Sesión expirada', 'Tu sesión fue cerrada. Vuelve a iniciar sesión.');
  setTimeout(() => {
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').classList.remove('hidden');
  }, 1200);
  throw new Error('Unauthorized');
}
  // Sin permisos
  if (res.status === 403) {
    showToast('Sin permisos', 'No tienes permisos para realizar esta acción.');
    throw new Error('Forbidden');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error ?? `Error ${res.status}`;
    showToast('Error', msg);
    throw new Error(msg);
  }

  return data;
}

/* ── Métodos convenientes ─────────────────────────────────────── */
const api = {
  get:    (path)         => apiFetch(path),
  post:   (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  (path, body)   => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path)         => apiFetch(path, { method: 'DELETE' }),
};
