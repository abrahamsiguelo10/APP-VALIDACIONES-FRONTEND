/**
 * users.js — Gestión de usuarios conectada a la API
 * Depende de: api.js, store.js
 */

/* ── Cargar y renderizar ─────────────────────────────────────── */
async function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text3)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Cargando usuarios…
    </td></tr>`;

  try {
    USERS = await api.get('/users');
    _paintUsersTable();
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--red)">
      Error al cargar usuarios.</td></tr>`;
  }
}

function _paintUsersTable() {
  const tbody       = document.getElementById('users-tbody');
  const currentUser = state.user?.username;
  if (!tbody) return;

  if (!USERS.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text3)">
      Sin usuarios registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  USERS.forEach(u => {
    const isMe      = u.username === currentUser;
    const roleBadge = u.role === 'admin'
      ? `<span class="badge red">Administrador</span>`
      : `<span class="badge sky">Operador</span>`;
    const statusBadge = u.enabled
      ? `<span class="badge green">Activo</span>`
      : `<span class="badge amber">Inactivo</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:26px;height:26px;border-radius:99px;background:linear-gradient(135deg,var(--sky),#6366f1);
            display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">
            ${u.username[0].toUpperCase()}
          </div>
          <span style="font-weight:500">${u.username}</span>
          ${isMe ? `<span style="font-size:10px;color:var(--text3)">(tú)</span>` : ''}
        </div>
      </td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn sm" title="Editar" onclick="editUser(${u.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn sm ${u.enabled ? 'danger' : 'success'}"
            title="${u.enabled ? 'Desactivar' : 'Activar'}"
            onclick="toggleUserActive(${u.id})"
            ${isMe ? 'disabled' : ''}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${u.enabled
                ? `<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>`
                : `<polyline points="20 6 9 17 4 12"/>`}
            </svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ── Formulario inline ───────────────────────────────────────── */
function openUserForm(editingId = null) {
  const form = document.getElementById('user-form-inline');
  document.getElementById('uf-editing').value   = editingId ?? '';
  document.getElementById('uf-password').value  = '';
  document.getElementById('uf-password2').value = '';
  document.getElementById('uf-error').style.display = 'none';

  if (editingId) {
    const u = USERS.find(x => String(x.id) === String(editingId));
    document.getElementById('uf-username').value        = u.username;
    document.getElementById('uf-role').value            = u.role;
    document.getElementById('uf-username').disabled     = true;
    document.getElementById('uf-pass-label').textContent = 'Nueva contraseña (vacío = sin cambios)';
    document.getElementById('uf-save-btn').textContent   = 'Guardar cambios';
  } else {
    document.getElementById('uf-username').value        = '';
    document.getElementById('uf-role').value            = 'user';
    document.getElementById('uf-username').disabled     = false;
    document.getElementById('uf-pass-label').textContent = 'Contraseña';
    document.getElementById('uf-save-btn').textContent   = 'Guardar usuario';
  }

  form.style.display = 'block';
  document.getElementById('uf-username').focus();
}

function closeUserForm() {
  document.getElementById('user-form-inline').style.display = 'none';
  document.getElementById('uf-username').disabled = false;
}

function showUfError(msg) {
  const el = document.getElementById('uf-error');
  el.textContent    = msg;
  el.style.display  = 'block';
}

/* ── Guardar usuario (crear o editar) ────────────────────────── */
async function saveUser() {
  const editingId = document.getElementById('uf-editing').value;
  const username  = document.getElementById('uf-username').value.trim().toLowerCase();
  const role      = document.getElementById('uf-role').value;
  const pass1     = document.getElementById('uf-password').value;
  const pass2     = document.getElementById('uf-password2').value;
  const btn       = document.getElementById('uf-save-btn');

  document.getElementById('uf-error').style.display = 'none';

  // Validaciones frontend
  if (!editingId && !username)
    return showUfError('El nombre de usuario es requerido.');
  if (!editingId && !/^[a-z0-9_]{3,32}$/.test(username))
    return showUfError('Solo letras minúsculas, números y _ (3-32 caracteres).');
  if (!editingId && !pass1)
    return showUfError('La contraseña es requerida.');
  if (pass1 && pass1.length < 4)
    return showUfError('La contraseña debe tener al menos 4 caracteres.');
  if (pass1 && pass1 !== pass2)
    return showUfError('Las contraseñas no coinciden.');

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    if (editingId) {
      const body = { role };
      if (pass1) body.password = pass1;
      await api.patch(`/users/${editingId}`, body);
      showToast('Usuario actualizado', `"${username}" guardado correctamente.`);
    } else {
      await api.post('/users', { username, password: pass1, role });
      showToast('Usuario creado', `"${username}" agregado correctamente.`);
    }
    closeUserForm();
    await renderUsersTable();
  } catch (_) {
    // El toast de error ya lo mostró api.js
  } finally {
    btn.disabled    = false;
    btn.textContent = editingId ? 'Guardar cambios' : 'Guardar usuario';
  }
}

function editUser(id) { openUserForm(id); }

/* ── Toggle activar/desactivar ───────────────────────────────── */
async function toggleUserActive(id) {
  const u = USERS.find(x => String(x.id) === String(id));
  if (!u) return;
  if (u.username === state.user?.username) return;

  try {
    const updated = await api.patch(`/users/${id}/toggle`, {});
    const status  = updated.enabled ? 'activado' : 'desactivado';
    showToast(`Usuario ${status}`, `"${u.username}" fue ${status}.`);
    await renderUsersTable();
  } catch (_) {}
}
