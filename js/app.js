/**
 * app.js — Inicialización, utilidades y validador
 * Carga ÚLTIMO. Depende de todos los demás módulos.
 */

/* ── Toast ────────────────────────────────────────────────────── */
let _toastTimer;
function showToast(title, msg) {
  clearTimeout(_toastTimer);
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-msg').textContent   = msg;
  const el = document.getElementById('toast');
  el.classList.add('show');
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ── Modal entrada (Nueva entrada) ───────────────────────────── */
let _modalSelectedDestId = null;
let _editingImei         = null;

async function openCreateModal() {
  _modalSelectedDestId = null;
  _editingImei         = null;

  document.getElementById('modal-title').textContent   = 'Nueva entrada';
  document.getElementById('modal-patente').value       = '';
  document.getElementById('modal-imei').value          = '';
  document.getElementById('modal-imei').readOnly       = false;
  document.getElementById('modal-imei').style.opacity  = '';

  const saveBtn       = document.getElementById('modal-save-btn');
  saveBtn.textContent = 'Guardar entrada';
  saveBtn.onclick     = saveEntry;

  const prev = document.getElementById('edit-dest-section');
  if (prev) prev.remove();

  // Mostrar modal con spinner mientras carga
  document.getElementById('modal-dest-grid').innerHTML = `
    <div style="text-align:center;padding:24px;color:var(--text3)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Cargando destinos…
    </div>`;
  _modalGoStep(1);
  document.getElementById('entry-modal').classList.add('show');

  // Siempre recargar ORGS frescos
  await loadOrgsFromAPI();
  _renderDestStep();
}

function closeModal() {
  document.getElementById('entry-modal').classList.remove('show');
  // Restaurar estado para próxima apertura en modo creación
  _editingImei = null;
  const imeiInput = document.getElementById('modal-imei');
  if (imeiInput) { imeiInput.readOnly = false; imeiInput.style.opacity = ''; }
  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) { saveBtn.textContent = 'Guardar entrada'; saveBtn.onclick = saveEntry; }
  const prev = document.getElementById('edit-dest-section');
  if (prev) prev.remove();
}

function _modalGoStep(n) {
  document.getElementById('msi-1').className = n === 1
    ? 'modal-step-indicator active' : 'modal-step-indicator done';
  document.getElementById('msi-2').className = n === 2
    ? 'modal-step-indicator active' : 'modal-step-indicator';
  document.getElementById('modal-step-dest').style.display = n === 1 ? '' : 'none';
  document.getElementById('modal-step-form').style.display = n === 2 ? '' : 'none';
}

function _renderDestStep() {
  const grid = document.getElementById('modal-dest-grid');
  const orgs = Object.entries(ORGS);

  if (!orgs.length) {
    grid.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">
        No hay destinos configurados aún.<br><br>
        <a href="#" onclick="closeModal();navigate('settings')" style="color:var(--sky)">
          → Crear destinos en Configuración
        </a>
      </div>`;
    return;
  }

  grid.innerHTML = orgs.map(([id, org]) => {
    const fieldCount = (org.fields||[])
      .filter(f => f.apiKey && !['patente','imei'].includes(f.apiKey.toLowerCase())).length;
    return `
      <div class="dest-card" onclick="modalSelectDest('${id}')">
        <span style="width:11px;height:11px;border-radius:99px;
          background:${org.color||'var(--sky)'};flex-shrink:0;
          box-shadow:0 0 0 3px ${org.color||'var(--sky)'}22"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${org.name}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap">
            <span>${fieldCount} campo${fieldCount !== 1 ? 's' : ''} adicional${fieldCount !== 1 ? 'es' : ''}</span>
            ${org.apiUrl
              ? `<span style="font-family:'DM Mono',monospace;overflow:hidden;text-overflow:ellipsis;
                   white-space:nowrap;max-width:220px">${org.apiUrl}</span>`
              : '<span style="color:var(--text3)">Sin URL configurada</span>'}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" style="color:var(--text3);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
  }).join('');
}

function modalSelectDest(orgId) {
  const org = ORGS[orgId];
  if (!org) return;
  _modalSelectedDestId = orgId;

  document.getElementById('modal-dest-badge').innerHTML = `
    <span style="width:9px;height:9px;border-radius:99px;background:${org.color||'var(--sky)'};flex-shrink:0"></span>
    <span style="font-size:12px;color:var(--text2)">Destino:</span>
    <strong style="font-size:13px">${org.name}</strong>
    ${org.apiUrl
      ? `<span style="margin-left:auto;font-size:11px;color:var(--text3);font-family:'DM Mono',monospace;
           overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px">${org.apiUrl}</span>`
      : ''}`;

  const fields = [...(org.fields||[])]
    .filter(f => f.apiKey && !['patente','imei'].includes(f.apiKey.toLowerCase()))
    .sort((a, b) => a.order - b.order);

  const wrap  = document.getElementById('modal-dest-fields-wrap');
  const title = document.getElementById('modal-dest-fields-title');
  const cont  = document.getElementById('modal-dest-fields');

  if (!fields.length) {
    wrap.style.display = 'none';
  } else {
    wrap.style.display = '';
    title.textContent  = `Campos requeridos por ${org.name}`;
    const rows = [];
    for (let i = 0; i < fields.length; i += 2) rows.push(fields.slice(i, i + 2));
    cont.innerHTML = rows.map(pair => `
      <div style="display:grid;grid-template-columns:${pair.length === 2 ? '1fr 1fr' : '1fr'};gap:10px">
        ${pair.map(f => `
          <div>
            <label class="label" style="display:flex;align-items:baseline;gap:4px">
              ${f.label || f.apiKey}
              ${f.required ? '<span style="color:var(--red);font-size:10px">*</span>' : ''}
              <span style="margin-left:auto;font-size:10px;color:var(--text3);
                font-family:\'DM Mono\',monospace">${f.apiKey}</span>
            </label>
            ${_buildField(f)}
          </div>`).join('')}
      </div>`).join('');
  }

  _modalGoStep(2);
}

function _buildField(f) {
  const attrs = `id="mf-${f.id}" data-apikey="${f.apiKey}" ${f.required ? 'required' : ''}`;
  switch (f.type) {
    case 'textarea': return `<textarea class="textarea" ${attrs} placeholder="${f.label||f.apiKey}" style="min-height:70px"></textarea>`;
    case 'select':   return `<select class="input" ${attrs}><option value="">– Seleccionar –</option></select>`;
    case 'number':   return `<input class="input" type="number" ${attrs} placeholder="${f.label||f.apiKey}" />`;
    case 'email':    return `<input class="input" type="email"  ${attrs} placeholder="${f.label||f.apiKey}" />`;
    case 'tel':      return `<input class="input" type="tel"    ${attrs} placeholder="${f.label||f.apiKey}" />`;
    case 'date':     return `<input class="input" type="date"   ${attrs} />`;
    default:         return `<input class="input" type="text"   ${attrs} placeholder="${f.label||f.apiKey}" />`;
  }
}

document.getElementById('entry-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('entry-modal')) closeModal();
});

/* ── Validador ────────────────────────────────────────────────── */
async function runValidator() {
  const patente = document.getElementById('val-patente').value.trim().toUpperCase();
  const imei    = document.getElementById('val-imei').value.trim();

  if (!patente && !imei) {
    showToast('Error', 'Ingresa una patente o IMEI para consultar.');
    return;
  }

  const btn = document.getElementById('btn-validar');
  btn.disabled    = true;
  btn.textContent = 'Consultando…';

  try {
    const data = imei
      ? await api.get(`/units/${imei}`)
      : await api.get(`/units?search=${encodeURIComponent(patente)}`);

    const unit = imei ? data : (Array.isArray(data) ? data[0] : null);

    const panel = document.getElementById('result-panel');
    panel.classList.add('show');

    if (!unit) {
      document.getElementById('res-plate').textContent             = patente || '–';
      document.getElementById('res-imei').textContent              = 'IMEI: ' + (imei || '–');
      document.getElementById('res-cliente').textContent           = '–';
      document.getElementById('res-rut').textContent               = '–';
      document.getElementById('res-destinos-count').textContent    = '0';
      document.getElementById('res-ping').textContent              = '–';
      const badge = document.getElementById('res-status-badge');
      badge.textContent = 'No encontrado';
      badge.className   = 'badge red';
      document.getElementById('res-destinos-list').innerHTML =
        '<span style="font-size:13px;color:var(--text2)">Unidad no registrada</span>';
      return;
    }

    document.getElementById('res-plate').textContent          = unit.plate || '–';
    document.getElementById('res-imei').textContent           = 'IMEI: ' + unit.imei;
    document.getElementById('res-cliente').textContent        = unit.name || '–';
    document.getElementById('res-rut').textContent            = '–';
    document.getElementById('res-destinos-count').textContent = (unit.destinations||[]).length;
    document.getElementById('res-ping').textContent           = '–';

    const badge = document.getElementById('res-status-badge');
    badge.textContent = unit.enabled ? 'Activo' : 'Inactivo';
    badge.className   = unit.enabled ? 'badge green' : 'badge red';

    const destList = document.getElementById('res-destinos-list');
    if (!(unit.destinations||[]).length) {
      destList.innerHTML = '<span style="font-size:13px;color:var(--text2)">Sin destinos asignados</span>';
    } else {
      destList.innerHTML = unit.destinations.map(d => `
        <span class="badge ${d.enabled ? 'sky' : 'amber'}" style="margin:2px">
          ${d.shadow ? '👁 ' : ''}${d.name}
        </span>`).join('');
    }

  } catch (_) {
    // El toast de error ya lo mostró api.js
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Consultar';
  }
}

function clearValidator() {
  document.getElementById('val-patente').value = '';
  document.getElementById('val-imei').value    = '';
  document.getElementById('result-panel').classList.remove('show');
}

/* ══════════════════════════════════════════════════════════════
   ADMIN TABLA
══════════════════════════════════════════════════════════════ */
let _adminUnits = [];

async function renderAdminTable() {
  const tbody = document.getElementById('admin-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Cargando unidades…
    </td></tr>`;

  try {
    _adminUnits = await api.get('/units');
    _paintAdminTable(_adminUnits);
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red)">
      Error al cargar unidades.</td></tr>`;
  }
}

function _paintAdminTable(units) {
  const tbody = document.getElementById('admin-tbody');
  const count = document.getElementById('admin-count');
  if (!tbody) return;

  if (count) count.textContent = `${units.length} entrada${units.length !== 1 ? 's' : ''}`;

  if (!units.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          <p>No hay unidades registradas</p>
          <small>Crea una nueva entrada con el botón "Nueva entrada"</small>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  units.forEach(u => {
    const destBadges = (u.destinations || []).map(d =>
      `<span class="badge ${d.enabled ? 'sky' : 'amber'}" style="margin:2px;font-size:10px">
        ${d.shadow ? '👁 ' : ''}${d.name}
      </span>`
    ).join('') || '<span style="font-size:12px;color:var(--text3)">—</span>';

    const statusBadge = u.enabled
      ? `<span class="badge green">Activo</span>`
      : `<span class="badge red">Inactivo</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="row-chk" data-imei="${u.imei}" onchange="updateDeleteBtn()" /></td>
      <td><span class="mono" style="font-weight:600;letter-spacing:.5px">${u.plate || '—'}</span></td>
      <td><span class="mono" style="font-size:12px;color:var(--text2)">${u.imei}</span></td>
      <td style="max-width:220px">${destBadges}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          ${statusBadge}
          <button class="btn sm" title="Editar" onclick="editAdminUnit('${u.imei}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterAdminTable() {
  const q = document.getElementById('admin-search')?.value.toLowerCase().trim() ?? '';
  if (!q) {
    _paintAdminTable(_adminUnits);
    return;
  }
  const filtered = _adminUnits.filter(u =>
    (u.plate  || '').toLowerCase().includes(q) ||
    (u.imei   || '').toLowerCase().includes(q) ||
    (u.name   || '').toLowerCase().includes(q) ||
    (u.destinations || []).some(d => d.name.toLowerCase().includes(q))
  );
  _paintAdminTable(filtered);
}

function toggleAll(chk) {
  document.querySelectorAll('.row-chk').forEach(el => el.checked = chk.checked);
  updateDeleteBtn();
}

function updateDeleteBtn() {
  const anyChecked = !!document.querySelector('.row-chk:checked');
  const btn = document.getElementById('btn-delete-selected');
  if (btn) btn.disabled = !anyChecked;
  const all  = document.querySelectorAll('.row-chk');
  const chkd = document.querySelectorAll('.row-chk:checked');
  const hdr  = document.getElementById('chk-all');
  if (hdr) hdr.indeterminate = chkd.length > 0 && chkd.length < all.length;
  if (hdr) hdr.checked = all.length > 0 && chkd.length === all.length;
}

/* ══════════════════════════════════════════════════════════════
   EDITAR UNIDAD
══════════════════════════════════════════════════════════════ */
async function editAdminUnit(imei) {
  _editingImei = imei;

  let unit = _adminUnits.find(u => u.imei === imei);
  if (!unit) {
    try { unit = await api.get(`/units/${imei}`); } catch (_) { return; }
  }

  // Siempre recargar ORGS frescos antes de abrir el modal
  await loadOrgsFromAPI();

  // Título y campos base
  document.getElementById('modal-title').textContent      = `Editar — ${unit.plate || unit.imei}`;
  document.getElementById('modal-patente').value          = unit.plate || '';
  document.getElementById('modal-imei').value             = unit.imei;
  document.getElementById('modal-imei').readOnly          = true;
  document.getElementById('modal-imei').style.opacity     = '0.6';

  // Botón guardar → modo edición
  const saveBtn       = document.getElementById('modal-save-btn');
  saveBtn.textContent = 'Guardar cambios';
  saveBtn.onclick     = saveEditEntry;

  // Ir directo al paso 2 (formulario con destinos)
  document.getElementById('modal-step-dest').style.display = 'none';
  document.getElementById('modal-step-form').style.display = '';
  document.getElementById('msi-1').className = 'modal-step-indicator done';
  document.getElementById('msi-2').className = 'modal-step-indicator active';

  // Badge modo edición
  document.getElementById('modal-dest-badge').innerHTML = `
    <span style="width:9px;height:9px;border-radius:99px;background:var(--sky);flex-shrink:0"></span>
    <span style="font-size:12px;color:var(--text2)">Modo edición</span>
    <strong style="font-size:13px">${unit.plate || unit.imei}</strong>`;

  // Ocultar campos dinámicos del destino
  document.getElementById('modal-dest-fields-wrap').style.display = 'none';

  // Quitar sección anterior si existe
  const prev = document.getElementById('edit-dest-section');
  if (prev) prev.remove();

  // Construir lista de destinos actuales + selector para agregar
  const assignedIds = new Set((unit.destinations || []).map(d => String(d.destination_id)));
  const available   = Object.entries(ORGS).filter(([id]) => !assignedIds.has(String(id)));

  const destRows = (unit.destinations || []).length
    ? (unit.destinations || []).map(d => `
        <div id="dest-row-${d.destination_id}" style="display:flex;align-items:center;gap:10px;
          padding:10px 12px;background:rgba(0,0,0,.2);border:1px solid var(--border);
          border-radius:var(--radius-sm)">
          <span style="width:9px;height:9px;border-radius:99px;flex-shrink:0;
            background:${d.enabled ? 'var(--green)' : 'var(--text3)'}"></span>
          <span style="flex:1;font-size:13px;font-weight:500">${d.name}</span>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;
            color:var(--text2);cursor:pointer;white-space:nowrap">
            <input type="checkbox" ${d.enabled ? 'checked' : ''}
              onchange="toggleUnitDest('${unit.imei}', '${d.destination_id}', this.checked)"
              style="cursor:pointer" />
            Habilitado
          </label>
          <button class="btn sm danger" title="Quitar destino"
            onclick="removeUnitDest('${unit.imei}', '${d.destination_id}', this)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>`).join('')
    : `<div style="font-size:13px;color:var(--text3);padding:8px 0">Sin destinos asignados aún.</div>`;

  // Selector inline para agregar destino
  const addSection = available.length ? `
    <div style="display:flex;gap:8px;margin-top:4px" id="add-dest-inline-wrap">
      <select class="input" id="add-dest-select" style="flex:1">
        <option value="">— Agregar destino —</option>
        ${available.map(([id, org]) => `<option value="${id}">${org.name}</option>`).join('')}
      </select>
      <button class="btn sm primary" onclick="confirmAddDest('${unit.imei}')">Agregar</button>
    </div>` : '';

  const body = document.querySelector('#modal-step-form .modal-body');
  const destSection = document.createElement('div');
  destSection.id = 'edit-dest-section';
  destSection.innerHTML = `
    <div style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;
      color:var(--text3);margin-bottom:8px">Destinos asignados</div>
    <div id="edit-dest-list" style="display:grid;gap:6px">${destRows}</div>
    ${addSection}`;
  body.appendChild(destSection);

  document.getElementById('entry-modal').classList.add('show');
}

async function saveEditEntry() {
  const imei  = _editingImei;
  const plate = document.getElementById('modal-patente').value.trim().toUpperCase();
  const btn   = document.getElementById('modal-save-btn');

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    await api.patch(`/units/${imei}`, { plate: plate || null });
    showToast('Guardado', `Unidad ${imei} actualizada.`);
    closeModal();
    // Refrescar caché y tabla para reflejar cambios
    _adminUnits = await api.get('/units');
    _paintAdminTable(_adminUnits);
  } catch (_) {
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar cambios';
  }
}

async function toggleUnitDest(imei, destId, enabled) {
  try {
    await api.patch(`/units/${imei}/destinations/${destId}`, { enabled });
    showToast(enabled ? 'Destino habilitado' : 'Destino deshabilitado', '');
    // Actualizar dot de color en la fila
    const row = document.getElementById(`dest-row-${destId}`);
    if (row) {
      const dot = row.querySelector('span[style*="border-radius:99px"]');
      if (dot) dot.style.background = enabled ? 'var(--green)' : 'var(--text3)';
    }
    // Actualizar caché
    const unit = _adminUnits.find(u => u.imei === imei);
    if (unit) {
      const d = unit.destinations.find(d => d.destination_id === destId);
      if (d) d.enabled = enabled;
    }
  } catch (_) {}
}

async function removeUnitDest(imei, destId, btn) {
  btn.disabled = true;
  try {
    await api.delete(`/units/${imei}/destinations/${destId}`);
    showToast('Destino eliminado', '');
    const row = document.getElementById(`dest-row-${destId}`);
    if (row) row.remove();
    // Actualizar caché
    const unit = _adminUnits.find(u => u.imei === imei);
    if (unit) unit.destinations = unit.destinations.filter(d => d.destination_id !== destId);
  } catch (_) {
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════
   GUARDAR NUEVA ENTRADA
══════════════════════════════════════════════════════════════ */
async function saveEntry() {
  const imei  = document.getElementById('modal-imei')?.value.trim();
  const plate = document.getElementById('modal-patente')?.value.trim().toUpperCase();
  const btn   = document.getElementById('modal-save-btn');

  if (!imei) {
    showToast('Error', 'El IMEI es requerido.');
    return;
  }
  if (!_modalSelectedDestId) {
    showToast('Error', 'Selecciona un destino primero.');
    return;
  }

  // Validar campos requeridos del schema
  const org    = ORGS[_modalSelectedDestId];
  const fields = (org?.fields || []).filter(f =>
    f.apiKey && !['patente','imei'].includes(f.apiKey.toLowerCase())
  );
  for (const f of fields) {
    if (f.required) {
      const el = document.getElementById('mf-' + f.id);
      if (el && !el.value.trim()) {
        showToast('Error', `El campo "${f.label || f.apiKey}" es requerido.`);
        el.focus();
        return;
      }
    }
  }

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    // 1. Verificar si la unidad ya existe
    let unitExists = false;
    try {
      const res = await fetch(`${CONFIG.API_URL}/units/${imei}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      unitExists = res.ok;
    } catch (_) {
      unitExists = false;
    }

    // 2. Crear unidad si no existe, o actualizar patente si se ingresó
    if (!unitExists) {
      await api.post('/units', { imei, plate: plate || null, name: null });
    } else if (plate) {
      await api.patch(`/units/${imei}`, { plate });
    }

    // 3. Asignar destino
    await api.post(`/units/${imei}/destinations`, {
      destination_id: _modalSelectedDestId,
    });

    showToast('Guardado', `Unidad ${imei} registrada en ${org.name}.`);
    closeModal();
    renderAdminTable();

  } catch (e) {
    if (e.message?.includes('ya tiene ese destino')) {
      showToast('Aviso', `Esta unidad ya está asignada a ${org?.name}.`);
    }
    // otros errores ya los muestra api.js
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar entrada';
  }
}

/* ── Excel / CSV file input ───────────────────────────────────── */
let _importData = []; // filas parseadas listas para importar

document.getElementById('excel-file').addEventListener('change', e => {
  const hasFile = !!e.target.files?.[0];
  document.getElementById('btn-preview').disabled = !hasFile;
  document.getElementById('btn-import').disabled  = !hasFile;
  _importData = [];
  document.getElementById('excel-preview').value = '';
});

/* ── Parsear archivo → array de objetos ──────────────────────── */
async function _parseImportFile() {
  const file = document.getElementById('excel-file').files?.[0];
  if (!file) return [];

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isCsv  = file.name.toLowerCase().endsWith('.csv');

    reader.onload = e => {
      try {
        const XLSX = window.XLSX;
        const wb   = isCsv
          ? XLSX.read(e.target.result, { type: 'string' })
          : XLSX.read(e.target.result, { type: 'binary' });

        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const normalized = rows.map(row => {
          const r = {};
          Object.keys(row).forEach(k => { r[k.toLowerCase().trim()] = String(row[k]).trim(); });
          return {
            imei:    r['imei']    || '',
            plate:   r['patente'] || r['plate'] || r['placa'] || '',
            cliente: r['cliente'] || '',
            destino: r['destino'] || r['organización'] || r['organizacion'] || r['org'] || '',
          };
        }).filter(r => r.imei);

        resolve(normalized);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = reject;
    isCsv ? reader.readAsText(file, 'UTF-8') : reader.readAsBinaryString(file);
  });
}

/* ── Vista previa ─────────────────────────────────────────────── */
async function previewImport() {
  const btn = document.getElementById('btn-preview');
  btn.disabled    = true;
  btn.textContent = 'Leyendo…';

  try {
    if (!window.XLSX) {
      // Cargar SheetJS dinámicamente si no está disponible
      await new Promise((res, rej) => {
        const s  = document.createElement('script');
        s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    _importData = await _parseImportFile();

    if (!_importData.length) {
      showToast('Aviso', 'No se encontraron filas válidas. Verifica que el archivo tenga columnas: IMEI, Patente, Cliente.');
      document.getElementById('excel-preview').value = '';
      return;
    }

    document.getElementById('excel-preview').value = JSON.stringify(_importData, null, 2);
    document.getElementById('btn-import').disabled  = false;
    showToast('Vista previa', `${_importData.length} filas encontradas.`);

  } catch (err) {
    showToast('Error', 'No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido.');
    console.error(err);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Vista previa';
  }
}

/* ── Importar ─────────────────────────────────────────────────── */
async function importExcel() {
  if (!_importData.length) {
    showToast('Error', 'Primero genera la vista previa.');
    return;
  }

  const btn = document.getElementById('btn-import');
  btn.disabled    = true;
  btn.textContent = 'Importando…';

  // Construir mapa nombre → id desde ORGS
  const orgByName = {};
  Object.entries(ORGS).forEach(([id, org]) => {
    orgByName[org.name.toLowerCase().trim()] = id;
  });

  let ok = 0, skipped = 0, errors = 0;

  for (const unit of _importData) {
    try {
      // 1. Verificar si la unidad ya existe
      let exists = false;
      try {
        const res = await fetch(`${CONFIG.API_URL}/units/${unit.imei}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        exists = res.ok;
      } catch (_) {}

      // 2. Crear o actualizar unidad
      if (!exists) {
        await api.post('/units', {
          imei:  unit.imei,
          plate: unit.plate   || null,
          name:  unit.cliente || null,
        });
        ok++;
      } else {
        await api.patch(`/units/${unit.imei}`, {
          plate: unit.plate   || null,
          name:  unit.cliente || null,
        });
        skipped++;
      }

      // 3. Asignar destino si viene en el archivo y existe en ORGS
      if (unit.destino) {
        const destId = orgByName[unit.destino.toLowerCase().trim()];
        if (destId) {
          try {
            await api.post(`/units/${unit.imei}/destinations`, {
              destination_id: destId,
            });
          } catch (e) {
            // Si ya tiene el destino asignado, ignorar el 409
            if (!e.message?.includes('ya tiene ese destino')) throw e;
          }
        } else {
          console.warn(`Destino no encontrado: "${unit.destino}"`);
        }
      }

    } catch (_) {
      errors++;
    }
  }

  showToast('Importación completa', `✓ ${ok} creadas · ↺ ${skipped} actualizadas · ✗ ${errors} errores`);

  // Limpiar estado
  _importData = [];
  document.getElementById('excel-file').value     = '';
  document.getElementById('excel-preview').value  = '';
  document.getElementById('btn-preview').disabled = true;
  document.getElementById('btn-import').disabled  = true;

  btn.disabled    = false;
  btn.textContent = 'Importar';

  renderAdminTable();
}

async function confirmAddDest(imei) {
  const destId = document.getElementById('add-dest-select')?.value;
  if (!destId) { showToast('Error', 'Selecciona un destino.'); return; }

  try {
    await api.post(`/units/${imei}/destinations`, { destination_id: destId });
    showToast('Destino agregado', 'Destino asignado correctamente.');
    _adminUnits = await api.get('/units');
    _paintAdminTable(_adminUnits);
    closeModal();
    editAdminUnit(imei);
  } catch (_) {}
}
/* ── CSS spinner (para loading states) ───────────────────────── */
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);

/* ── Init: restaurar sesión al cargar ────────────────────────── */
restoreSession();

async function deleteUnit(imei) {
  if (!confirm(`¿Eliminar la unidad ${imei}? Esta acción no se puede deshacer.`)) return;
  try {
    await api.delete(`/units/${imei}`);
    showToast('Eliminado', `Unidad ${imei} eliminada.`);
    renderAdminTable();
  } catch (_) {}
}

/* ── Exportar Excel ───────────────────────────────────────────── */
async function exportExcel() {
  try {
    const units = await api.get('/units');

    if (!units.length) {
      showToast('Exportar', 'No hay datos para exportar.');
      return;
    }

    const BOM     = '\uFEFF';
    const headers = ['IMEI', 'Patente', 'Cliente', 'Destino'];

    const rows = units.map(u => [
      u.imei  || '',
      u.plate || '',
      u.name  || '',
      (u.destinations || []).map(d => d.name).join(' | '),
    ]);

    const csv = BOM + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `unidades_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Exportar', `${units.length} unidades exportadas.`);

  } catch (_) {
    showToast('Error', 'No se pudo exportar. Verifica la conexión.');
  }
}