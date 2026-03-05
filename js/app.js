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

function openCreateModal() {
  _modalSelectedDestId = null;
  document.getElementById('modal-title').textContent = 'Nueva entrada';
  document.getElementById('modal-patente').value = '';
  document.getElementById('modal-imei').value    = '';
  _modalGoStep(1);
  _renderDestStep();
  document.getElementById('entry-modal').classList.add('show');
}

function closeModal() {
  document.getElementById('entry-modal').classList.remove('show');
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

function modalBackToDest() {
  _modalSelectedDestId = null;
  _modalGoStep(1);
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
    // Buscar por IMEI si existe, si no buscar por patente
    const endpoint = imei ? `/units/${imei}` : `/units?search=${encodeURIComponent(patente)}`;
    const data     = imei
      ? await api.get(`/units/${imei}`)
      : await api.get(`/units?search=${encodeURIComponent(patente)}`);

    const unit = imei ? data : (Array.isArray(data) ? data[0] : null);

    const panel = document.getElementById('result-panel');
    panel.classList.add('show');

    if (!unit) {
      document.getElementById('res-plate').textContent = patente || '–';
      document.getElementById('res-imei').textContent  = 'IMEI: ' + (imei || '–');
      document.getElementById('res-cliente').textContent        = '–';
      document.getElementById('res-rut').textContent            = '–';
      document.getElementById('res-destinos-count').textContent = '0';
      document.getElementById('res-ping').textContent           = '–';
      const badge = document.getElementById('res-status-badge');
      badge.textContent = 'No encontrado';
      badge.className   = 'badge red';
      document.getElementById('res-destinos-list').innerHTML =
        '<span style="font-size:13px;color:var(--text2)">Unidad no registrada</span>';
      return;
    }

    document.getElementById('res-plate').textContent = unit.plate || '–';
    document.getElementById('res-imei').textContent  = 'IMEI: ' + unit.imei;
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

/* ── Admin tabla ──────────────────────────────────────────────── */
function filterAdminTable() {
  showToast('Buscar', 'Funcionalidad próximamente');
}
function toggleAll(chk) { /* placeholder */ }

/* ── Excel file input ─────────────────────────────────────────── */
document.getElementById('excel-file').addEventListener('change', e => {
  const hasFile = !!e.target.files?.[0];
  document.getElementById('btn-preview').disabled = !hasFile;
  document.getElementById('btn-import').disabled  = !hasFile;
});

/* ── CSS spinner (para loading states) ───────────────────────── */
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);

/* ── Init: restaurar sesión al cargar ────────────────────────── */
restoreSession();

/* ── Guardar nueva entrada ────────────────────────────────────── */
async function saveEntry() {
  const imei   = document.getElementById('modal-imei')?.value.trim();
  const plate  = document.getElementById('modal-patente')?.value.trim().toUpperCase();
  const btn    = document.getElementById('modal-save-btn');

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
  // 1. Verificar si la unidad ya existe (fetch directo para evitar toast de error)
let unitExists = false;
try {
  const res = await fetch(`${CONFIG.API_URL}/units/${imei}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  unitExists = res.ok;
} catch (_) {
  unitExists = false;
}
    // 2. Crear unidad si no existe
    if (!unitExists) {
      await api.post('/units', {
        imei,
        plate: plate || null,
        name:  null,
      });
    } else if (plate) {
      // Actualizar patente si ya existe y se ingresó una
      await api.patch(`/units/${imei}`, { plate });
    }

    // 3. Asignar destino
    await api.post(`/units/${imei}/destinations`, {
      destination_id: _modalSelectedDestId,
    });

    showToast('Guardado', `Unidad ${imei} registrada en ${org.name}.`);
    closeModal();

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