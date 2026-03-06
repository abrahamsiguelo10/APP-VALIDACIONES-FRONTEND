/**
 * roles.js — Gestión de roles personalizados
 * Depende de: api.js, store.js
 */

const MODULES_LABELS = {
  dashboard: 'Dashboard',
  validador: 'Validador',
  admin:     'Admin Patentes/IMEI',
  settings:  'Configuración',
};

/* ── Cargar y renderizar ─────────────────────────────────────── */
async function renderRolesTable() {
  const tbody = document.getElementById('roles-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text3)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Cargando roles…
    </td></tr>`;

  try {
    ROLES = await api.get('/roles');
    _paintRolesTable();
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--red)">
      Error al cargar roles.</td></tr>`;
  }
}

function _paintRolesTable() {
  const tbody = document.getElementById('roles-tbody');
  if (!tbody) return;

  if (!ROLES.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text3)">
      No hay roles personalizados. Crea uno con el botón "Nuevo rol".</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  ROLES.forEach(r => {
    const moduleBadges = (r.modules || []).map(m =>
      `<span class="badge sky" style="font-size:10px;margin:2px">${MODULES_LABELS[m] || m}</span>`
    ).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="mono" style="font-size:12px">${r.id}</span></td>
      <td><span style="font-weight:500">${r.label}</span></td>
      <td>${moduleBadges}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn sm" title="Editar" onclick="editRole('${r.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn sm danger" title="Eliminar" onclick="deleteRole('${r.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ── Formulario ──────────────────────────────────────────────── */
function openRoleForm(editId = null) {
  const form = document.getElementById('role-form-inline');
  form.style.display = '';

  document.getElementById('rf-editing').value = editId || '';
  document.getElementById('rf-error').style.display = 'none';
  document.getElementById('rf-save-btn').textContent = editId ? 'Guardar cambios' : 'Guardar rol';

  const idInput = document.getElementById('rf-id');
  idInput.disabled = !!editId; // ID no editable en modo edición
  idInput.style.opacity = editId ? '0.6' : '';

  if (editId) {
    const role = ROLES.find(r => r.id === editId);
    if (!role) return;
    idInput.value = role.id;
    document.getElementById('rf-label').value = role.label;
    document.querySelectorAll('.rf-module').forEach(chk => {
      chk.checked = (role.modules || []).includes(chk.value);
    });
  } else {
    idInput.value = '';
    document.getElementById('rf-label').value = '';
    document.querySelectorAll('.rf-module').forEach(chk => chk.checked = false);
  }

  idInput.focus();
}

function closeRoleForm() {
  document.getElementById('role-form-inline').style.display = 'none';
  document.getElementById('rf-error').style.display = 'none';
}

function editRole(id) { openRoleForm(id); }

async function saveRole() {
  const editingId = document.getElementById('rf-editing').value;
  const id        = document.getElementById('rf-id').value.trim().toLowerCase();
  const label     = document.getElementById('rf-label').value.trim();
  const modules   = ['dashboard', ...Array.from(document.querySelectorAll('.rf-module:checked')).map(c => c.value)];

  const errEl = document.getElementById('rf-error');
  const btn   = document.getElementById('rf-save-btn');

  errEl.style.display = 'none';

  if (!editingId && !id)    { errEl.textContent = 'El ID es requerido.';     errEl.style.display = ''; return; }
  if (!editingId && !/^[a-z0-9_]{2,32}$/.test(id))
    { errEl.textContent = 'ID: solo letras minúsculas, números y _ (2-32 caracteres).'; errEl.style.display = ''; return; }
  if (!label)               { errEl.textContent = 'El nombre es requerido.'; errEl.style.display = ''; return; }

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    if (editingId) {
      await api.patch(`/roles/${editingId}`, { label, modules });
      showToast('Rol actualizado', `"${label}" guardado correctamente.`);
    } else {
      await api.post('/roles', { id, label, modules });
      showToast('Rol creado', `"${label}" creado correctamente.`);
    }
    closeRoleForm();
    await renderRolesTable();
  } catch (_) {
  } finally {
    btn.disabled    = false;
    btn.textContent = editingId ? 'Guardar cambios' : 'Guardar rol';
  }
}

async function deleteRole(id) {
  const role = ROLES.find(r => r.id === id);
  if (!confirm(`¿Eliminar el rol "${role?.label || id}"? Esta acción no se puede deshacer.`)) return;

  try {
    await api.delete(`/roles/${id}`);
    showToast('Rol eliminado', '');
    await renderRolesTable();
  } catch (_) {}
}