/**
 * clientes.js — Gestión de clientes con token de validador
 */

let _clientes = [];

/* ── Cargar y pintar tabla ───────────────────────────────────── */
async function renderClientesTable() {
  const tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>Cargando…
    </td></tr>`;

  try {
    _clientes = await api.get('/clientes');
    _paintClientesTable();
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red)">
      Error al cargar clientes.</td></tr>`;
  }
}

function _paintClientesTable() {
  const tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;

  if (!_clientes.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>No hay clientes registrados</p>
          <small>Crea un cliente para generar su token de acceso al validador</small>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = _clientes.map(c => `
    <tr>
      <td style="font-weight:600">${c.nombre}</td>
      <td><span class="mono" style="font-size:12px">${c.rut || '<span style="color:var(--text3)">—</span>'}</span></td>
      <td><span class="badge sky">${c.total_units ?? 0} unidades</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="mono" style="font-size:11px;color:var(--text3);
            max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${c.token}">${c.token}</span>
          <button class="btn sm" title="Copiar token" onclick="copyToken('${c.token}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="btn sm" title="Copiar link validador" onclick="copyValidadorLink('${c.token}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </button>
        </div>
      </td>
      <td>${c.enabled
        ? '<span class="badge green">Activo</span>'
        : '<span class="badge red">Inactivo</span>'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn sm ${c.enabled ? 'danger' : 'success'}"
            onclick="toggleCliente('${c.id}', this)">
            ${c.enabled ? 'Desactivar' : 'Activar'}
          </button>
          <button class="btn sm primary" onclick="openAsignarUnidades('${c.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Unidades
          </button>
          <button class="btn sm" onclick="editCliente('${c.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn sm" title="Regenerar token" onclick="regenToken('${c.id}', '${c.nombre}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
            </svg>
          </button>
          <button class="btn sm" title="Establecer contraseña de acceso" onclick="setClientePassword('${c.id}', '${c.nombre}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
          <button class="btn sm danger" onclick="deleteCliente('${c.id}', '${c.nombre}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

/* ── Formulario inline ───────────────────────────────────────── */
function openClienteForm() {
  document.getElementById('cf-nombre').value  = '';
  document.getElementById('cf-rut').value     = '';
  document.getElementById('cf-editing').value = '';
  document.getElementById('cf-save-btn').textContent = 'Guardar cliente';
  document.getElementById('cf-error').style.display  = 'none';
  document.getElementById('cliente-form-inline').style.display = '';
  document.getElementById('cf-nombre').focus();
}

function closeClienteForm() {
  document.getElementById('cliente-form-inline').style.display = 'none';
}

function editCliente(id) {
  const c = _clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cf-nombre').value  = c.nombre;
  document.getElementById('cf-rut').value     = c.rut || '';
  document.getElementById('cf-editing').value = id;
  document.getElementById('cf-save-btn').textContent = 'Guardar cambios';
  document.getElementById('cf-error').style.display  = 'none';
  document.getElementById('cliente-form-inline').style.display = '';
  document.getElementById('cf-nombre').focus();
}

async function saveCliente() {
  const nombre  = document.getElementById('cf-nombre').value.trim();
  const rut     = document.getElementById('cf-rut').value.trim();
  const editing = document.getElementById('cf-editing').value;
  const errEl   = document.getElementById('cf-error');
  const btn     = document.getElementById('cf-save-btn');

  if (!nombre) {
    errEl.textContent = 'El nombre es requerido.';
    errEl.style.display = '';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Guardando…';
  errEl.style.display = 'none';

  try {
    if (editing) {
      await api.patch(`/clientes/${editing}`, { nombre, rut: rut || null });
      showToast('Guardado', `Cliente "${nombre}" actualizado.`);
    } else {
      await api.post('/clientes', { nombre, rut: rut || null });
      showToast('Creado', `Cliente "${nombre}" creado con token de acceso.`);
    }
    closeClienteForm();
    await renderClientesTable();
    loadClientesForSelect(); // refrescar selector del modal
  } catch (e) {
    errEl.textContent = e.message || 'Error al guardar.';
    errEl.style.display = '';
  } finally {
    btn.disabled    = false;
    btn.textContent = editing ? 'Guardar cambios' : 'Guardar cliente';
  }
}

/* ── Acciones ────────────────────────────────────────────────── */
async function toggleCliente(id, btn) {
  const c = _clientes.find(x => x.id === id);
  if (!c) return;
  btn.disabled = true;
  try {
    await api.patch(`/clientes/${id}`, { enabled: !c.enabled });
    showToast(c.enabled ? 'Desactivado' : 'Activado', `Cliente "${c.nombre}" actualizado.`);
    await renderClientesTable();
    loadClientesForSelect();
  } catch (_) {
    btn.disabled = false;
  }
}

async function deleteCliente(id, nombre) {
  if (!confirm(`¿Eliminar cliente "${nombre}"? Esto revocará su acceso al validador.`)) return;
  try {
    await api.delete(`/clientes/${id}`);
    showToast('Eliminado', `Cliente "${nombre}" eliminado.`);
    await renderClientesTable();
    loadClientesForSelect();
  } catch (_) {}
}

async function regenToken(id, nombre) {
  if (!confirm(`¿Regenerar el token de "${nombre}"? El link anterior dejará de funcionar.`)) return;
  try {
    const res = await api.post(`/clientes/${id}/regen-token`, {});
    showToast('Token regenerado', 'Copia el nuevo token antes de cerrar.');
    await renderClientesTable();
  } catch (_) {}
}

function copyToken(token) {
  navigator.clipboard.writeText(token).then(() => {
    showToast('Copiado', 'Token copiado al portapapeles.');
  });
}

async function setClientePassword(id, nombre) {
  const password = prompt(`Contraseña de acceso para "${nombre}":\n(Mínimo 6 caracteres)`);
  if (password === null) return;
  if (!password || password.length < 6) {
    showToast('Error', 'La contraseña debe tener al menos 6 caracteres.', 'error');
    return;
  }
  try {
    await api.post(`/clientes/${id}/set-password`, { password });
    showToast('Contraseña establecida', `Acceso configurado para "${nombre}".`);
  } catch (e) {
    showToast('Error', e.message || 'No se pudo establecer la contraseña.', 'error');
  }
}

function copyValidadorLink(token) {
  const url = `${window.location.origin}/validador.html?token=${token}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copiado', 'Comparte este link con el cliente.');
  });
}

/* ── Cargar clientes en el selector del modal ────────────────── */
async function loadClientesForSelect() {
  const sel = document.getElementById('modal-cliente-id');
  if (!sel) return;

  try {
    const clientes = await api.get('/clientes');
    const current  = sel.value;
    sel.innerHTML  = '<option value="">— Sin cuenta asignada —</option>' +
      clientes
        .filter(c => c.enabled)
        .map(c => `<option value="${c.id}">${c.nombre}${c.rut ? ` · ${c.rut}` : ''}</option>`)
        .join('');
    if (current) sel.value = current;
  } catch (_) {}
}

/* ── Hook: cargar tabla cuando se activa la pestaña ─────────── */
// Sobreescribe el switchSettingsTab original para interceptar 'clientes'
(function() {
  // Al cambiar de pestaña en settings: cerrar el form y recargar tabla si es 'clientes'
  const _origSettings = window.switchSettingsTab;
  window.switchSettingsTab = function(tab) {
    closeClienteForm();
    if (typeof _origSettings === 'function') _origSettings(tab);
    if (tab === 'clientes') renderClientesTable();
  };
})();

/* ── Modal asignar unidades a cliente ────────────────────────── */
let _asignandoClienteId = null;

async function openAsignarUnidades(clienteId) {
  _asignandoClienteId = clienteId;
  const c = _clientes.find(x => x.id === clienteId);
  if (!c) return;

  const modal = document.getElementById('asignar-modal');
  document.getElementById('asignar-modal-title').textContent = `Unidades de "${c.nombre}"`;
  document.getElementById('asignar-list').innerHTML = `
    <div style="text-align:center;padding:24px;color:var(--text3)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>Cargando unidades…
    </div>`;
  modal.classList.add('show');

  try {
    const units = await api.get('/units');
    const assigned = units.filter(u => u.cliente_id === clienteId);
    const unassigned = units.filter(u => !u.cliente_id);

    document.getElementById('asignar-list').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--text3)">
          Asignadas a este cliente (${assigned.length})
        </span>
        ${assigned.length ? `
          <button class="btn sm danger" id="btn-desasignar-sel" onclick="desasignarSeleccionadas()"
            style="display:none">Quitar seleccionadas (0)</button>` : ''}
      </div>
      <div id="asignar-assigned-list">
      ${assigned.length ? assigned.map(u => `
        <div style="display:grid;grid-template-columns:20px 1fr auto auto;align-items:center;
          gap:10px;padding:8px 10px;
          background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);
          border-radius:var(--radius-sm);margin-bottom:4px">
          <input type="checkbox" class="chk-desasignar" data-imei="${u.imei}"
            onchange="actualizarSelDesasignar()"
            style="width:15px;height:15px;cursor:pointer;accent-color:var(--red)">
          <span class="mono" style="font-weight:600;overflow:hidden;
            text-overflow:ellipsis;white-space:nowrap">${u.plate || '—'}</span>
          <span class="mono" style="font-size:11px;color:var(--text2);white-space:nowrap">${u.imei}</span>
          <button class="btn sm danger" style="white-space:nowrap"
            onclick="desasignarUnidad('${u.imei}')">Quitar</button>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Sin unidades asignadas aún.</div>'}
      </div>

      <!-- ── SIN ASIGNAR ── -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px">
        <span style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--text3)">
          Sin cliente asignado (${unassigned.length})
        </span>
        ${unassigned.length ? `
          <button class="btn sm primary" id="btn-asignar-sel" onclick="asignarSeleccionadas()"
            style="display:none">Asignar seleccionadas (0)</button>` : ''}
      </div>
      ${unassigned.length ? `
        <div style="margin-bottom:8px">
          <input class="input" id="asignar-search" placeholder="Buscar patente o IMEI…"
            oninput="filtrarAsignar()" style="width:100%;box-sizing:border-box;font-size:13px" />
        </div>
        <div id="asignar-unidades-list" style="display:flex;flex-direction:column;gap:4px">
          ${unassigned.map(u => `
            <div style="display:grid;grid-template-columns:20px 1fr auto auto;align-items:center;
              gap:10px;padding:8px 10px;
              background:rgba(0,0,0,.15);border:1px solid var(--border);
              border-radius:var(--radius-sm)"
              data-plate="${(u.plate||'').toLowerCase()}" data-imei="${u.imei.toLowerCase()}">
              <input type="checkbox" class="chk-asignar" data-imei="${u.imei}"
                onchange="actualizarSelAsignar()"
                style="width:15px;height:15px;cursor:pointer;accent-color:var(--sky)">
              <span class="mono" style="font-weight:600;overflow:hidden;
                text-overflow:ellipsis;white-space:nowrap">${u.plate || '—'}</span>
              <span class="mono" style="font-size:11px;color:var(--text2);white-space:nowrap">${u.imei}</span>
              <button class="btn sm primary" style="white-space:nowrap"
                onclick="asignarUnidad('${u.imei}')">Asignar</button>
            </div>`).join('')}
        </div>` : '<div style="font-size:12px;color:var(--text3)">Todas las unidades tienen cliente asignado.</div>'}
    `;
  } catch (_) {
    document.getElementById('asignar-list').innerHTML =
      '<div style="color:var(--red);padding:12px">Error al cargar unidades.</div>';
  }
}

function filtrarAsignar() {
  const q = document.getElementById('asignar-search')?.value.toLowerCase() || '';
  document.querySelectorAll('#asignar-unidades-list > div').forEach(el => {
    const match = el.dataset.plate?.includes(q) || el.dataset.imei?.includes(q);
    el.style.display = match ? '' : 'none';
    if (!match) {
      const chk = el.querySelector('.chk-asignar');
      if (chk) chk.checked = false;
    }
  });
  actualizarSelAsignar();
}

async function asignarUnidad(imei) {
  try {
    await api.patch(`/units/${imei}`, { cliente_id: _asignandoClienteId });
    showToast('Asignado', `Unidad ${imei} asignada al cliente.`);
    openAsignarUnidades(_asignandoClienteId);
    renderClientesTable();
  } catch (_) {}
}

async function desasignarUnidad(imei) {
  try {
    await api.patch(`/units/${imei}`, { cliente_id: null });
    showToast('Quitado', `Unidad ${imei} sin cliente.`);
    openAsignarUnidades(_asignandoClienteId);
    renderClientesTable();
  } catch (_) {}
}

/* ── Selección múltiple — asignar ─────────────────────────────── */
function actualizarSelAsignar() {
  const checked = [...document.querySelectorAll('.chk-asignar:checked')];
  const btn = document.getElementById('btn-asignar-sel');
  if (!btn) return;
  btn.style.display = checked.length ? '' : 'none';
  btn.textContent = `Asignar seleccionadas (${checked.length})`;
}

async function asignarSeleccionadas() {
  const checked = [...document.querySelectorAll('.chk-asignar:checked')];
  if (!checked.length) return;
  const btn = document.getElementById('btn-asignar-sel');
  btn.disabled = true;
  btn.textContent = 'Asignando…';
  try {
    await Promise.allSettled(
      checked.map(chk => api.patch(`/units/${chk.dataset.imei}`, { cliente_id: _asignandoClienteId }))
    );
    showToast('Asignadas', `${checked.length} unidad${checked.length !== 1 ? 'es' : ''} asignada${checked.length !== 1 ? 's' : ''}.`);
    openAsignarUnidades(_asignandoClienteId);
    renderClientesTable();
  } catch (_) {
    btn.disabled = false;
    actualizarSelAsignar();
  }
}

/* ── Selección múltiple — desasignar ─────────────────────────── */
function actualizarSelDesasignar() {
  const checked = [...document.querySelectorAll('.chk-desasignar:checked')];
  const btn = document.getElementById('btn-desasignar-sel');
  if (!btn) return;
  btn.style.display = checked.length ? '' : 'none';
  btn.textContent = `Quitar seleccionadas (${checked.length})`;
}

async function desasignarSeleccionadas() {
  const checked = [...document.querySelectorAll('.chk-desasignar:checked')];
  if (!checked.length) return;
  const btn = document.getElementById('btn-desasignar-sel');
  btn.disabled = true;
  btn.textContent = 'Quitando…';
  try {
    await Promise.allSettled(
      checked.map(chk => api.patch(`/units/${chk.dataset.imei}`, { cliente_id: null }))
    );
    showToast('Quitadas', `${checked.length} unidad${checked.length !== 1 ? 'es' : ''} desasignada${checked.length !== 1 ? 's' : ''}.`);
    openAsignarUnidades(_asignandoClienteId);
    renderClientesTable();
  } catch (_) {
    btn.disabled = false;
    actualizarSelDesasignar();
  }
}

function closeAsignarModal() {
  document.getElementById('asignar-modal').classList.remove('show');
  _asignandoClienteId = null;
}
