/**
 * js/gestion_clientes.js
 * Vista admin "Gestión de Clientes" — módulo id: 'gestion_clientes'
 */

/* ════════════════════════════════════════════════════════════════
   ESTADO LOCAL
════════════════════════════════════════════════════════════════ */
let _gc_clientes    = [];
let _gc_filtered    = [];
let _gc_expanded    = new Set();
let _gc_units_cache = {};
let _gc_loading     = false;

/* ════════════════════════════════════════════════════════════════
   ENTRADA — llamada desde nav.js al activar la vista
   FIX 1: eliminado if(_gc_loading) duplicado
   FIX 2: retry con límite de 5 intentos (300ms cada uno = 1.5s)
════════════════════════════════════════════════════════════════ */
async function renderGestionClientes() {
  if (_gc_loading) return;

  // FIX: si no hay token aún, reintentar hasta 5 veces con delay
  if (!getToken()) {
    let retries = 0;
    const waitForToken = setInterval(() => {
      retries++;
      if (getToken()) {
        clearInterval(waitForToken);
        renderGestionClientes();
      } else if (retries >= 5) {
        clearInterval(waitForToken);
        const container = document.getElementById('gc-container');
        if (container) container.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;
                      justify-content:center;padding:60px;color:var(--text3);gap:16px">
            <p>Sesión no disponible.</p>
            <button class="btn primary" onclick="renderGestionClientes()">Reintentar</button>
          </div>`;
      }
    }, 300);
    return;
  }

  _gc_loading = true;
  _gc_expanded.clear();
  _gc_units_cache = {};

  const container = document.getElementById('gc-container');
  if (!container) { _gc_loading = false; return; }

  _gcShowLoading(container);

  try {
    _gc_clientes = await api.get('/clientes');
    _gc_filtered  = [..._gc_clientes];
    _gcRender();
  } catch (e) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
                  justify-content:center;padding:60px;color:var(--red);gap:16px">
        <p>Error al cargar clientes: ${e.message}</p>
        <button class="btn primary" onclick="renderGestionClientes()">Reintentar</button>
      </div>`;
  } finally {
    _gc_loading = false;
  }
}

/* ════════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════════════════════════ */
function _gcRender() {
  const container = document.getElementById('gc-container');
  if (!container) return;

  container.innerHTML = `
    <!-- ── HEADER ── -->
    <div class="gc-header">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="search-box" style="position:relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3)">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input class="input" id="gc-search" placeholder="Buscar cliente, RUT…"
                 oninput="gcFiltrar()" style="padding-left:32px;min-width:220px" />
        </div>
        <span id="gc-count" style="font-size:12px;color:var(--text3)">
          ${_gc_clientes.length} cliente${_gc_clientes.length !== 1 ? 's' : ''}
        </span>
      </div>
      <button class="btn primary" onclick="gcOpenForm()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nuevo cliente
      </button>
    </div>

    <!-- ── FORMULARIO INLINE ── -->
    <div id="gc-form-inline" style="display:none" class="card">
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;flex-wrap:wrap">
        <div>
          <label class="label">Nombre <span style="color:var(--red)">*</span></label>
          <input class="input" id="gc-f-nombre" placeholder="Nombre del cliente" />
        </div>
        <div>
          <label class="label">RUT</label>
          <input class="input" id="gc-f-rut" placeholder="76.123.456-7" />
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn primary" id="gc-f-save-btn" onclick="gcSaveCliente()">Guardar</button>
          <button class="btn" onclick="gcCloseForm()">Cancelar</button>
        </div>
      </div>
      <div id="gc-f-error" class="error-msg" style="display:none;margin-top:8px"></div>
      <input type="hidden" id="gc-f-editing" />
    </div>

    <!-- ── CHARTS ── -->
    <div id="gc-charts" class="gc-charts-grid">
      ${_gcBuildCharts()}
    </div>

    <!-- ── TABLA ── -->
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table" id="gc-table">
        <thead>
          <tr>
            <th style="width:32px"></th>
            <th>Cliente</th>
            <th>RUT</th>
            <th>Unidades</th>
            <th>Integraciones</th>
            <th>Último evento</th>
            <th>Estado</th>
            <th style="width:120px">Acciones</th>
          </tr>
        </thead>
        <tbody id="gc-tbody">
          ${_gcBuildRows()}
        </tbody>
      </table>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════════
   CHARTS SVG (sin librerías)
════════════════════════════════════════════════════════════════ */
function _gcBuildCharts() {
  const total = _gc_filtered.length;
  if (!total) return '';

  const activos    = _gc_filtered.filter(c => c.enabled).length;
  const inactivos  = total - activos;
  const totalUnits = _gc_filtered.reduce((s, c) => s + (c.total_units || 0), 0);
  const totalDests = _gc_filtered.reduce((s, c) => s + (c.total_destinations || 0), 0);
  const ahora      = Date.now();
  const reportando = _gc_filtered.filter(c =>
    c.last_event_at && (ahora - new Date(c.last_event_at).getTime()) < 86400000
  ).length;
  const sinReportar = total - reportando;

  return `
    <div class="gc-chart-card">
      <div class="gc-chart-title">Clientes</div>
      ${_gcPie([
        { label: 'Activos',   value: activos,   color: '#22c55e' },
        { label: 'Inactivos', value: inactivos, color: '#ef4444' },
      ])}
    </div>
    <div class="gc-chart-card">
      <div class="gc-chart-title">Reporte últimas 24 h</div>
      ${_gcPie([
        { label: 'Reportando',   value: reportando,  color: '#38bdf8' },
        { label: 'Sin reportar', value: sinReportar, color: '#6b7280' },
      ])}
    </div>
    <div class="gc-chart-card gc-chart-stat">
      <div class="gc-chart-title">Totales</div>
      <div class="gc-stat-row">
        <span class="badge sky">${totalUnits}</span>
        <span>unidades asignadas</span>
      </div>
      <div class="gc-stat-row">
        <span class="badge purple">${totalDests}</span>
        <span>integraciones activas</span>
      </div>
      <div class="gc-stat-row">
        <span class="badge green">${activos}</span>
        <span>clientes activos</span>
      </div>
    </div>
  `;
}

function _gcPie(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">Sin datos</div>`;

  const cx = 60, cy = 60, r = 50;
  let startAngle = -Math.PI / 2;
  let paths = '';

  segments.forEach(seg => {
    if (!seg.value) return;
    const angle    = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z"
                    fill="${seg.color}" opacity="0.9"/>`;
    startAngle = endAngle;
  });

  paths += `<circle cx="${cx}" cy="${cy}" r="28" fill="var(--bg2,#1a1a2e)"/>`;
  paths += `<text x="${cx}" y="${cy+5}" text-anchor="middle"
                  font-size="16" font-weight="700" fill="var(--text1,#fff)">${total}</text>`;

  const legend = segments.map(s => `
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)">
      <span style="width:10px;height:10px;border-radius:2px;background:${s.color};flex-shrink:0"></span>
      <span>${s.label}: <strong>${s.value}</strong></span>
    </div>`).join('');

  return `
    <div style="display:flex;align-items:center;gap:16px">
      <svg width="120" height="120" viewBox="0 0 120 120">${paths}</svg>
      <div style="display:flex;flex-direction:column;gap:6px">${legend}</div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   FILAS DE TABLA
════════════════════════════════════════════════════════════════ */
function _gcBuildRows() {
  if (!_gc_filtered.length) {
    return `<tr><td colspan="8">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <p>No se encontraron clientes</p>
      </div>
    </td></tr>`;
  }

  return _gc_filtered.map(c => {
    const expanded = _gc_expanded.has(c.id);
    const lastEvt  = c.last_event_at
      ? _gcTimeAgo(c.last_event_at)
      : '<span style="color:var(--text3)">Sin eventos</span>';

    return `
      <tr class="gc-row ${expanded ? 'gc-row-expanded' : ''}" data-id="${c.id}">
        <td>
          <button class="btn sm gc-expand-btn" title="${expanded ? 'Colapsar' : 'Ver unidades'}"
                  onclick="gcToggleExpand('${c.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" style="transition:transform .2s;transform:rotate(${expanded ? '90' : '0'}deg)">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </td>
        <td style="font-weight:600">${c.nombre}</td>
        <td><span class="mono" style="font-size:12px">${c.rut || '<span style="color:var(--text3)">—</span>'}</span></td>
        <td><span class="badge sky">${c.total_units ?? 0}</span></td>
        <td><span class="badge purple">${c.total_destinations ?? 0}</span></td>
        <td style="font-size:12px">${lastEvt}</td>
        <td>${c.enabled
          ? '<span class="badge green">Activo</span>'
          : '<span class="badge red">Inactivo</span>'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn sm primary" title="Editar" onclick="gcEditCliente('${c.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn sm ${c.enabled ? 'danger' : 'success'}" title="${c.enabled ? 'Desactivar' : 'Activar'}"
                    onclick="gcToggleCliente('${c.id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18.36 6.64A9 9 0 0 1 20 12a9 9 0 1 1-3.64-7.36"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
            </button>
            <button class="btn sm danger" title="Eliminar" onclick="gcDeleteCliente('${c.id}','${c.nombre}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
      ${expanded ? `<tr class="gc-detail-row" id="gc-detail-${c.id}">
        <td colspan="8" style="padding:0">
          <div class="gc-detail-wrap" id="gc-detail-inner-${c.id}">
            ${_gc_units_cache[c.id]
              ? _gcBuildUnitsDetail(c.id)
              : '<div style="padding:16px;color:var(--text3);font-size:13px">Cargando unidades…</div>'}
          </div>
        </td>
      </tr>` : ''}
    `;
  }).join('');
}

/* ════════════════════════════════════════════════════════════════
   DETALLE DE UNIDADES (fila expandida)
════════════════════════════════════════════════════════════════ */
function _gcBuildUnitsDetail(clienteId) {
  const units = _gc_units_cache[clienteId];
  if (!units || !units.length) {
    return `<div style="padding:16px;font-size:13px;color:var(--text3)">
      Sin unidades asignadas.
      <button class="btn sm primary" style="margin-left:10px"
              onclick="gcOpenAsignarUnidades('${clienteId}')">Asignar unidades</button>
    </div>`;
  }

  const rows = units.map(u => {
    const ahora  = Date.now();
    const diffMs = u.last_event_at ? ahora - new Date(u.last_event_at).getTime() : null;

    let estadoBadge;
    if (!u.enabled) {
      estadoBadge = '<span class="badge red">Deshabilitada</span>';
    } else if (!diffMs) {
      estadoBadge = '<span class="badge" style="background:rgba(107,114,128,.2);color:#9ca3af">Sin datos</span>';
    } else if (diffMs < 10 * 60 * 1000) {
      estadoBadge = '<span class="badge green">En línea</span>';
    } else if (diffMs < 60 * 60 * 1000) {
      estadoBadge = '<span class="badge sky">Reciente</span>';
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      estadoBadge = '<span class="badge" style="background:rgba(251,191,36,.15);color:#fbbf24">Inactiva hoy</span>';
    } else {
      estadoBadge = '<span class="badge red">Sin reportar</span>';
    }

    const ignicion = u.last_ignition === true
      ? '<span class="badge green" style="font-size:10px">🔑 Encendida</span>'
      : u.last_ignition === false
        ? '<span class="badge" style="background:rgba(107,114,128,.15);color:#9ca3af;font-size:10px">⚫ Apagada</span>'
        : '';

    const destinos = (u.destinations || []).map(d =>
      `<span class="badge" style="background:${d.color || '#38bdf8'}22;color:${d.color || '#38bdf8'};
             border:1px solid ${d.color || '#38bdf8'}44;font-size:10px;${!d.enabled ? 'opacity:.45' : ''}">
        ${d.name}${d.shadow ? ' 👁' : ''}
      </span>`
    ).join('');

    return `
      <tr>
        <td><span class="mono" style="font-weight:600">${u.plate || '—'}</span></td>
        <td><span class="mono" style="font-size:11px;color:var(--text3)">${u.imei}</span></td>
        <td>${estadoBadge} ${ignicion}</td>
        <td style="font-size:11px">
          ${u.last_event_at
            ? `<span title="${new Date(u.last_event_at).toLocaleString('es-CL')}">
                Recibido: ${_gcTimeAgo(u.last_event_at)}</span>`
            : '<span style="color:var(--text3)">—</span>'}
        </td>
        <td style="font-size:11px">
          ${u.last_forward_at
            ? `<span title="${new Date(u.last_forward_at).toLocaleString('es-CL')}">
                Enviado: ${_gcTimeAgo(u.last_forward_at)}</span>`
            : '<span style="color:var(--text3)">—</span>'}
        </td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${destinos || '<span style="color:var(--text3);font-size:11px">Sin destinos</span>'}
          </div>
        </td>
      </tr>`;
  }).join('');

  const clienteNombre = _gc_clientes.find(c => c.id === clienteId)?.nombre || '';

  return `
    <div style="padding:12px 16px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:11px;font-weight:600;letter-spacing:.5px;
                     text-transform:uppercase;color:var(--text3)">
          Unidades de "${clienteNombre}" (${units.length})
        </span>
        <button class="btn sm primary" onclick="gcOpenAsignarUnidades('${clienteId}')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Gestionar unidades
        </button>
      </div>
      <div style="overflow-x:auto">
        <table class="table" style="font-size:12px">
          <thead>
            <tr>
              <th>Patente</th><th>IMEI</th><th>Estado</th>
              <th>Último recibido</th><th>Último enviado</th><th>Destinos</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   EXPAND / COLAPSAR
════════════════════════════════════════════════════════════════ */
async function gcToggleExpand(clienteId) {
  if (_gc_expanded.has(clienteId)) {
    _gc_expanded.delete(clienteId);
    document.getElementById(`gc-detail-${clienteId}`)?.remove();
    const mainRow = document.querySelector(`tr.gc-row[data-id="${clienteId}"]`);
    if (mainRow) {
      mainRow.classList.remove('gc-row-expanded');
      const btn = mainRow.querySelector('.gc-expand-btn svg');
      if (btn) btn.style.transform = 'rotate(0deg)';
    }
    return;
  }

  _gc_expanded.add(clienteId);
  const mainRow = document.querySelector(`tr.gc-row[data-id="${clienteId}"]`);
  if (mainRow) {
    mainRow.classList.add('gc-row-expanded');
    const btn = mainRow.querySelector('.gc-expand-btn svg');
    if (btn) btn.style.transform = 'rotate(90deg)';

    const detailTr = document.createElement('tr');
    detailTr.className = 'gc-detail-row';
    detailTr.id = `gc-detail-${clienteId}`;
    detailTr.innerHTML = `<td colspan="8" style="padding:0">
      <div class="gc-detail-wrap" id="gc-detail-inner-${clienteId}">
        <div style="padding:16px;color:var(--text3);font-size:13px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>Cargando unidades…
        </div>
      </div>
    </td>`;
    mainRow.insertAdjacentElement('afterend', detailTr);
  }

  if (!_gc_units_cache[clienteId]) {
    try {
      _gc_units_cache[clienteId] = await api.get(`/clientes/${clienteId}/units`);
    } catch {
      _gc_units_cache[clienteId] = [];
    }
  }

  const inner = document.getElementById(`gc-detail-inner-${clienteId}`);
  if (inner) inner.innerHTML = _gcBuildUnitsDetail(clienteId);
}

/* ════════════════════════════════════════════════════════════════
   FORMULARIO CRUD
════════════════════════════════════════════════════════════════ */
function gcOpenForm() {
  document.getElementById('gc-f-nombre').value  = '';
  document.getElementById('gc-f-rut').value     = '';
  document.getElementById('gc-f-editing').value = '';
  document.getElementById('gc-f-save-btn').textContent = 'Guardar cliente';
  document.getElementById('gc-f-error').style.display  = 'none';
  document.getElementById('gc-form-inline').style.display = '';
  document.getElementById('gc-f-nombre').focus();
}

function gcCloseForm() {
  document.getElementById('gc-form-inline').style.display = 'none';
}

function gcEditCliente(id) {
  const c = _gc_clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('gc-f-nombre').value  = c.nombre;
  document.getElementById('gc-f-rut').value     = c.rut || '';
  document.getElementById('gc-f-editing').value = id;
  document.getElementById('gc-f-save-btn').textContent = 'Guardar cambios';
  document.getElementById('gc-f-error').style.display  = 'none';
  document.getElementById('gc-form-inline').style.display = '';
  document.getElementById('gc-f-nombre').focus();
  document.getElementById('gc-form-inline').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function gcSaveCliente() {
  const nombre  = document.getElementById('gc-f-nombre').value.trim();
  const rut     = document.getElementById('gc-f-rut').value.trim();
  const editing = document.getElementById('gc-f-editing').value;
  const errEl   = document.getElementById('gc-f-error');
  const btn     = document.getElementById('gc-f-save-btn');

  if (!nombre) {
    errEl.textContent = 'El nombre es requerido.';
    errEl.style.display = '';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Guardando…';
  errEl.style.display = 'none';

  try {
    if (editing) {
      await api.patch(`/clientes/${editing}`, { nombre, rut: rut || null });
      showToast('Guardado', `Cliente "${nombre}" actualizado.`);
    } else {
      await api.post('/clientes', { nombre, rut: rut || null });
      showToast('Creado', `Cliente "${nombre}" creado.`);
    }
    gcCloseForm();
    _gc_expanded.clear();
    _gc_units_cache = {};
    await renderGestionClientes();
    if (typeof loadClientesForSelect === 'function') loadClientesForSelect();
  } catch (e) {
    errEl.textContent = e.message || 'Error al guardar.';
    errEl.style.display = '';
  } finally {
    btn.disabled = false;
    btn.textContent = editing ? 'Guardar cambios' : 'Guardar cliente';
  }
}

async function gcToggleCliente(id) {
  const c = _gc_clientes.find(x => x.id === id);
  if (!c) return;
  try {
    await api.patch(`/clientes/${id}`, { enabled: !c.enabled });
    showToast(c.enabled ? 'Desactivado' : 'Activado', `Cliente "${c.nombre}" actualizado.`);
    delete _gc_units_cache[id];
    await renderGestionClientes();
    if (typeof loadClientesForSelect === 'function') loadClientesForSelect();
  } catch (e) {
    showToast('Error', e.message || 'No se pudo actualizar.');
  }
}

async function gcDeleteCliente(id, nombre) {
  if (!confirm(`¿Eliminar cliente "${nombre}"?\nSus unidades quedarán sin cliente asignado.`)) return;
  try {
    await api.delete(`/clientes/${id}`);
    showToast('Eliminado', `Cliente "${nombre}" eliminado.`);
    delete _gc_units_cache[id];
    _gc_expanded.delete(id);
    await renderGestionClientes();
    if (typeof loadClientesForSelect === 'function') loadClientesForSelect();
  } catch (e) {
    showToast('Error', e.message || 'No se pudo eliminar.');
  }
}

/* ════════════════════════════════════════════════════════════════
   BÚSQUEDA / FILTRO
════════════════════════════════════════════════════════════════ */
function gcFiltrar() {
  const q = (document.getElementById('gc-search')?.value || '').toLowerCase().trim();
  _gc_filtered = q
    ? _gc_clientes.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        (c.rut || '').toLowerCase().includes(q)
      )
    : [..._gc_clientes];

  const tbody  = document.getElementById('gc-tbody');
  if (tbody)  tbody.innerHTML  = _gcBuildRows();
  const charts = document.getElementById('gc-charts');
  if (charts) charts.innerHTML = _gcBuildCharts();
  const count  = document.getElementById('gc-count');
  if (count)  count.textContent = `${_gc_filtered.length} cliente${_gc_filtered.length !== 1 ? 's' : ''}`;
}

/* ════════════════════════════════════════════════════════════════
   GESTIÓN DE UNIDADES — reutiliza modal de clientes.js
   FIX: sincroniza _clientes antes de abrir para evitar fallo silencioso
════════════════════════════════════════════════════════════════ */
function gcOpenAsignarUnidades(clienteId) {
  if (typeof openAsignarUnidades !== 'function') return;

  // FIX: siempre sincronizar _clientes con los datos actuales de esta vista
  if (typeof _clientes !== 'undefined') {
    _clientes = [..._gc_clientes];
  }

  openAsignarUnidades(clienteId);

  // Refrescar esta vista al cerrar el modal
  const origClose = window.closeAsignarModal;
  window.closeAsignarModal = function() {
    if (typeof origClose === 'function') origClose();
    delete _gc_units_cache[clienteId];
    renderGestionClientes();
    window.closeAsignarModal = origClose; // restaurar
  };
}

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
function _gcTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function _gcShowLoading(container) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;
                padding:60px;color:var(--text3);gap:10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" style="animation:spin 1s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Cargando clientes…
    </div>`;
}
