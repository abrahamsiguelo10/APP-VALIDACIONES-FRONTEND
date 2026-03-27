/**
 * orgs.js — Gestión de organizaciones/destinos
 * Depende de: api.js, store.js
 */

let activeOrgId = null;

// ── Fuentes GPS disponibles ───────────────────────────────────────────────────
// Tres categorías:
//   GPS_*    → datos que llegan automáticamente del dispositivo GPS
//   UNIT_*   → datos de la unidad/cliente en la DB de Síguelo
//   FIXED    → valor constante definido manualmente en la configuración
const GPS_SOURCES = [
  // ── Sin mapear ──
  { value: '',               label: '— Sin mapear —',                  group: '' },

  // ── Datos GPS (automáticos del dispositivo) ──
  { value: 'lat',            label: 'Latitud',                          group: 'GPS' },
  { value: 'lon',            label: 'Longitud',                         group: 'GPS' },
  { value: 'speed',          label: 'Velocidad (km/h)',                 group: 'GPS' },
  { value: 'heading',        label: 'Dirección / Heading (°)',          group: 'GPS' },
  { value: 'ignition',       label: 'Ignición (true/false)',            group: 'GPS' },
  { value: 'ignition01',     label: 'Ignición (0 / 1)',                 group: 'GPS' },
  { value: 'wialon_ts',      label: 'Timestamp ISO 8601',               group: 'GPS' },
  { value: 'fecha_hora',     label: 'Fecha/Hora (DD-MM-YYYY HH:MM:SS)',  group: 'GPS' },
  { value: 'fecha_slash',    label: 'Fecha/Hora (DD/MM/YYYY HH:MM:SS)',  group: 'GPS' },
  { value: 'alt',            label: 'Altitud (m)',                      group: 'GPS' },
  { value: 'sats',           label: 'Satélites',                        group: 'GPS' },
  { value: 'hdop',           label: 'HDOP',                             group: 'GPS' },
  { value: 'odometro',       label: 'Odómetro',                         group: 'GPS' },

  // ── Datos de la unidad (de la DB de Síguelo) ──
  { value: 'unit_plate',     label: 'Patente de la unidad',             group: 'Unidad' },
  { value: 'unit_imei',      label: 'IMEI de la unidad',                group: 'Unidad' },
  { value: 'unit_name',      label: 'Nombre de la unidad',              group: 'Unidad' },
  { value: 'unit_rut',       label: 'RUT de la unidad',                 group: 'Unidad' },
  { value: 'cliente_nombre', label: 'Nombre del cliente',               group: 'Unidad' },
  { value: 'cliente_rut',    label: 'RUT del cliente',                  group: 'Unidad' },

  // ── Valor fijo ──
  { value: 'fixed',          label: 'Valor fijo (definir abajo)',       group: 'Fijo' },
];

// Generar <optgroup> para el selector
function _buildSourceOptions(selected) {
  const groups = {};
  GPS_SOURCES.forEach(s => {
    const g = s.group || '_';
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });

  let html = '';
  const labels = { '': '', 'GPS': 'Datos GPS (automáticos)', 'Unidad': 'Datos de la unidad / cliente', 'Fijo': 'Valor fijo' };
  Object.entries(groups).forEach(([g, items]) => {
    if (g === '_' || g === '') {
      items.forEach(s => { html += `<option value="${s.value}" ${selected===s.value?'selected':''}>${s.label}</option>`; });
    } else {
      html += `<optgroup label="${labels[g]||g}">`;
      items.forEach(s => { html += `<option value="${s.value}" ${selected===s.value?'selected':''}>${s.label}</option>`; });
      html += `</optgroup>`;
    }
  });
  return html;
}

function _gpsSourceLabel(val) {
  return GPS_SOURCES.find(s => s.value === val)?.label || val || '—';
}

// ── Plantillas predefinidas ───────────────────────────────────────────────────
const GPS_TEMPLATES = {
  pelambres: {
    label:       'Pelambres / Skynav',
    description: 'Formato requerido por Minera Los Pelambres vía Skynav',
    fields: [
      { apiKey: 'patente',   label: 'Patente',        source: 'unit_plate',  required: true  },
      { apiKey: 'imei',      label: 'IMEI',           source: 'unit_imei',   required: true  },
      { apiKey: 'latitud',   label: 'Latitud',        source: 'lat',         required: true  },
      { apiKey: 'longitud',  label: 'Longitud',       source: 'lon',         required: true  },
      { apiKey: 'altitud',   label: 'Altitud',        source: 'alt',         required: false },
      { apiKey: 'fechaHora', label: 'Fecha y Hora',   source: 'fecha_hora',  required: true  },
      { apiKey: 'evento',    label: 'Evento',         source: 'ignition01',  required: false },
      { apiKey: 'velocidad', label: 'Velocidad',      source: 'speed',       required: true  },
      { apiKey: 'heading',   label: 'Heading',        source: 'heading',     required: false },
      { apiKey: 'ignicion',  label: 'Ignición (0/1)', source: 'ignition01',  required: true  },
      { apiKey: 'satelites', label: 'Satélites',      source: 'sats',        required: false },
      { apiKey: 'hdop',      label: 'HDOP',           source: 'hdop',        required: false },
    ],
  },
  generico: {
    label:       'GPS Genérico',
    description: 'Campos estándar para la mayoría de integraciones',
    fields: [
      { apiKey: 'plate',     label: 'Patente',        source: 'unit_plate',  required: true  },
      { apiKey: 'imei',      label: 'IMEI',           source: 'unit_imei',   required: true  },
      { apiKey: 'lat',       label: 'Latitud',        source: 'lat',         required: true  },
      { apiKey: 'lon',       label: 'Longitud',       source: 'lon',         required: true  },
      { apiKey: 'speed',     label: 'Velocidad',      source: 'speed',       required: false },
      { apiKey: 'heading',   label: 'Heading',        source: 'heading',     required: false },
      { apiKey: 'ignition',  label: 'Ignición',       source: 'ignition',    required: false },
      { apiKey: 'ts',        label: 'Timestamp',      source: 'wialon_ts',   required: true  },
      { apiKey: 'alt',       label: 'Altitud',        source: 'alt',         required: false },
      { apiKey: 'client',    label: 'Cliente',        source: 'cliente_nombre', required: false },
      { apiKey: 'rut',       label: 'RUT cliente',    source: 'cliente_rut', required: false },
    ],
  },
  wialon: {
    label:       'Wialon / Fecha slash',
    description: 'Formato con fecha DD/MM/YYYY HH:MM:SS',
    fields: [
      { apiKey: 'patente',   label: 'Patente',        source: 'unit_plate',   required: true  },
      { apiKey: 'imei',      label: 'IMEI',           source: 'unit_imei',    required: true  },
      { apiKey: 'lat',       label: 'Latitud',        source: 'lat',          required: true  },
      { apiKey: 'lon',       label: 'Longitud',       source: 'lon',          required: true  },
      { apiKey: 'vel',       label: 'Velocidad',      source: 'speed',        required: false },
      { apiKey: 'curso',     label: 'Heading',        source: 'heading',      required: false },
      { apiKey: 'ignicion',  label: 'Ignición (0/1)', source: 'ignition01',   required: false },
      { apiKey: 'fecha',     label: 'Fecha/Hora',     source: 'fecha_slash',  required: true  },
      { apiKey: 'alt',       label: 'Altitud',        source: 'alt',          required: false },
      { apiKey: 'cliente',   label: 'Cliente',        source: 'cliente_nombre', required: false },
    ],
  },
};

function orgApplyTemplate(orgId, templateKey) {
  const tpl = GPS_TEMPLATES[templateKey];
  if (!tpl || !ORGS[orgId]) return;
  const existing = (ORGS[orgId].fields || []).filter(f => f.apiKey || f.source);
  if (existing.length > 0) {
    if (!confirm(`Esta acción reemplazará los ${existing.length} campo(s) existentes con la plantilla "${tpl.label}". ¿Continuar?`)) return;
  }
  ORGS[orgId].fields = tpl.fields.map((f, i) => ({
    id: 'f' + Date.now() + i, apiKey: f.apiKey, label: f.label,
    source: f.source, fixedValue: '', type: 'text', required: f.required, order: i + 1,
  }));
  _saveFieldsToAPI(orgId);
  renderFieldsList(orgId);
  renderPayloadPreview(orgId);
  showToast('Plantilla aplicada', `"${tpl.label}" — ${ORGS[orgId].fields.length} campos configurados.`);
}

function orgClearFields(orgId) {
  if (!confirm('¿Limpiar todos los campos?')) return;
  ORGS[orgId].fields = [];
  _saveFieldsToAPI(orgId);
  renderFieldsList(orgId);
  renderPayloadPreview(orgId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Función global para abrir menú de plantillas con posicionamiento dinámico
function _openTplMenu(btn, menuId) {
  var m = document.getElementById(menuId);
  if (!m) return;
  // Toggle: si ya está abierto, cerrar
  if (m._tplOpen) { m._tplOpen = false; m.style.display = 'none'; return; }
  // Mover al body para escapar cualquier overflow:hidden ancestro
  document.body.appendChild(m);
  // Estilos
  m.style.position     = 'fixed';
  m.style.zIndex       = '9000';
  m.style.background   = 'var(--surface2)';
  m.style.border       = '1px solid var(--border2)';
  m.style.borderRadius = 'var(--radius)';
  m.style.boxShadow    = '0 16px 48px rgba(0,0,0,.65)';
  m.style.width        = '320px';
  m.style.overflow     = 'hidden';
  // Posición debajo del botón
  var r = btn.getBoundingClientRect();
  var menuW = 320;
  var left = Math.min(r.right - menuW, window.innerWidth - menuW - 8);
  left = Math.max(8, left);
  m.style.top  = (r.bottom + 4) + 'px';
  m.style.left = left + 'px';
  m.style.display = 'block';
  m._tplOpen = true;
  // Cerrar al hacer click fuera — usar requestAnimationFrame para evitar
  // que el mismo evento click que abrió cierre inmediatamente
  requestAnimationFrame(function() {
    function _close(e) {
      if (!m.contains(e.target) && e.target !== btn) {
        m.style.display = 'none';
        m._tplOpen = false;
        document.removeEventListener('click', _close, true);
      }
    }
    document.addEventListener('click', _close, true);
  });
}


// ── CRUD de headers personalizados ───────────────────────────────────────────
function _refreshCustomHeadersList(orgId) {
  const container = document.getElementById('oe-ch-list-'+orgId);
  if (!container) return;
  const headers = ORGS[orgId]?.auth?.headers || [];
  container.innerHTML = _renderCustomHeadersList(orgId, headers);
  // Foco en el último input añadido
  const inputs = container.querySelectorAll('input');
  if (inputs.length) inputs[inputs.length - 2]?.focus();
}

// Guarda el auth del destino (usado por las funciones de headers)
async function _saveAuthToAPI(orgId) {
  try {
    const org = ORGS[orgId];
    if (!org) return;
    const auth = org.auth || null;
    await api.patch('/destinations/' + orgId, { ...orgToDestPatch(org), auth });
  } catch(_) {}
}

function orgAuthHeaderAdd(orgId) {
  const org = ORGS[orgId];
  if (!org) return;
  if (!org.auth) org.auth = { type: 'custom-headers', headers: [] };
  if (!Array.isArray(org.auth.headers)) org.auth.headers = [];
  org.auth.headers.push({ key: '', value: '' });
  _saveAuthToAPI(orgId);
  // Re-renderizar si el contenedor no existe aún (primera vez)
  const container = document.getElementById('oe-ch-list-'+orgId);
  if (!container) {
    renderOrgEditor(orgId);
  } else {
    _refreshCustomHeadersList(orgId);
  }
}

function orgAuthHeaderRemove(orgId, idx) {
  const org = ORGS[orgId];
  if (!org?.auth?.headers) return;
  org.auth.headers.splice(idx, 1);
  _saveAuthToAPI(orgId);
  _refreshCustomHeadersList(orgId);
}

function orgAuthHeaderChange(orgId, idx, field, val) {
  const org = ORGS[orgId];
  if (!org?.auth?.headers?.[idx]) return;
  org.auth.headers[idx][field] = val;
  _saveAuthToAPI(orgId);
}


function _renderCustomHeadersList(orgId, headers) {
  return headers.map((h, i) => `
    <div style="display:grid;grid-template-columns:1fr 1fr 28px;gap:6px;align-items:center">
      <input class="input" style="font-size:12px" placeholder="Nombre del header (ej: Username)"
        value="${escHtml(h.key||'')}"
        oninput="orgAuthHeaderChange('${orgId}',${i},'key',this.value)" />
      <input class="input" style="font-size:12px" placeholder="Valor"
        value="${escHtml(h.value||'')}"
        oninput="orgAuthHeaderChange('${orgId}',${i},'value',this.value)" />
      <button class="btn sm danger" style="padding:4px;justify-content:center"
        onclick="orgAuthHeaderRemove('${orgId}',${i})">✕</button>
    </div>
  `).join('');
}

async function loadOrgsFromAPI() {
  try {
    const dests = await api.get('/destinations');
    ORGS = {};
    dests.forEach(d => { ORGS[d.id] = destToOrg(d); });
  } catch (_) { showToast('Error', 'No se pudieron cargar los destinos.'); }
}

async function renderOrgList() {
  await loadOrgsFromAPI();
  const list = document.getElementById('org-list');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(ORGS).forEach(([id, org]) => {
    const hasAuth     = !!(org.auth && org.auth.type && org.auth.type !== 'none');
    const mappedFields = (org.fields || []).filter(f => f.source && f.source !== '').length;
    const el = document.createElement('div');
    el.className = 'nav-item' + (id === activeOrgId ? ' active' : '');
    el.style.cssText = 'gap:10px;padding:8px 10px';
    el.innerHTML = `
      <span style="width:8px;height:8px;border-radius:99px;background:${org.color||'var(--sky)'};flex-shrink:0;display:inline-block"></span>
      <span style="flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${org.name}</span>
      ${hasAuth     ? `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(52,211,153,.15);color:var(--green);font-weight:500">auth</span>` : ''}
      ${mappedFields > 0 ? `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(56,189,248,.12);color:var(--sky);font-weight:500">${mappedFields} GPS</span>` : ''}
      <span style="font-size:11px;color:var(--text3)">${(org.fields||[]).length} campos</span>`;
    el.onclick = () => { activeOrgId = id; renderOrgList(); renderOrgEditor(id); };
    list.appendChild(el);
  });
}

async function orgNew() {
  const localId = 'org-' + Date.now();
  const body = { id: localId, name: 'Nueva organización', api_url: '', color: '#34d399', field_schema: [] };
  try {
    const resp = await api.post('/destinations', body);
    const realId = resp.id || localId;
    ORGS[realId] = destToOrg({ ...resp, field_schema: resp.field_schema || [] });
    activeOrgId = realId;
    await renderOrgList();
    renderOrgEditor(realId);
  } catch (e) { showToast('Error', 'No se pudo crear la organización.'); }
}

function _eyeBtn(targetId) {
  return `<button type="button" onclick="(function(b){var i=document.getElementById('${targetId}');if(!i)return;var s=i.type==='password';i.type=s?'text':'password';b.style.opacity=s?'1':'.4';})(this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:var(--text3);display:flex;align-items:center;opacity:.4"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
}
function _authLabel(t) { return {none:'Sin auth',bearer:'Bearer Token',basic:'Basic Auth','basic-in-body':'Basic (body)','bearer+basic':'Bearer+Basic',apikey:'API Key','custom-headers':'Headers personalizados'}[t]||t; }
function _authBadgeStyle(t) {
  if(t==='bearer')        return 'background:rgba(99,102,241,.15);color:#818cf8;border:none';
  if(t==='basic')         return 'background:rgba(52,211,153,.15);color:var(--green);border:none';
  if(t==='basic-in-body') return 'background:rgba(52,211,153,.15);color:var(--green);border:none';
  if(t==='bearer+basic')  return 'background:rgba(99,102,241,.15);color:#818cf8;border:none';
  if(t==='apikey')        return 'background:rgba(251,191,36,.15);color:#f59e0b;border:none';
  if(t==='custom-headers') return 'background:rgba(56,189,248,.15);color:var(--sky);border:none';
  return 'background:var(--bg2);color:var(--text3);border:none';
}

function renderOrgEditor(id) {
  const org = ORGS[id];
  if (!org) return;
  const a = org.auth || {}, at = a.type || 'none';
  const show = t => {
    // basic-in-body y bearer+basic comparten el panel de basic
    const effective = (t === 'basic' && (at === 'basic-in-body')) ? at :
                      (t === 'bearer+basic' && at === 'bearer+basic') ? t : t;
    const match = at === effective || at === t ||
                  (t === 'basic' && (at === 'basic-in-body'));
    return `display:${match?(t==='none'?'block':'grid'):'none'}`;
  };

  document.getElementById('org-editor').innerHTML = `
    <div style="display:grid;gap:16px">

      <!-- IDENTIDAD -->
      <div class="card">
        <div class="card-header">
          <h3>Identidad de la organización</h3>
          <div id="del-confirm-${id}" style="display:flex;gap:6px;align-items:center">
            <button class="btn sm danger" onclick="orgDeletePrompt('${id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg> Eliminar
            </button>
          </div>
        </div>
        <div class="card-body" style="display:grid;gap:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:12px;align-items:end">
            <div>
              <label class="label">Nombre de la organización</label>
              <input class="input" id="oe-name" value="${escHtml(org.name)}" />
            </div>
            <div>
              <label class="label">URL de la API</label>
              <input class="input mono" id="oe-url" value="${escHtml(org.apiUrl||'')}" placeholder="https://..." />
            </div>
            <div>
              <label class="label">Color</label>
              <input type="color" class="input" id="oe-color" value="${org.color||'#38bdf8'}" style="padding:4px;height:38px;cursor:pointer" />
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div id="oe-save-feedback" style="font-size:12px;color:var(--green);display:none;align-items:center;gap:5px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Cambios guardados
            </div>
            <button class="btn primary" style="margin-left:auto" onclick="orgSaveMeta('${id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar
            </button>
            <button class="btn sm" onclick="orgClose()" style="padding:4px 8px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- AUTENTICACIÓN -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Autenticación de la API</h3>
            <div class="sub" style="margin-top:3px">Credenciales enviadas en cada solicitud GPS</div>
          </div>
          <span id="oe-auth-badge" style="font-size:11px;padding:3px 10px;border-radius:20px;font-weight:500;${_authBadgeStyle(at)}">${_authLabel(at)}</span>
        </div>
        <div class="card-body" style="display:grid;gap:16px">
          <div>
            <label class="label">Tipo de autenticación</label>
            <select class="input" id="oe-auth-type" style="max-width:260px" onchange="orgAuthTypeChange('${id}')">
              <option value="none"          ${at==='none'         ?'selected':''}>Sin autenticación</option>
              <option value="bearer"        ${at==='bearer'       ?'selected':''}>Bearer Token</option>
              <option value="basic"         ${at==='basic'        ?'selected':''}>Basic Auth — header</option>
              <option value="basic-in-body" ${at==='basic-in-body'?'selected':''}>Basic Auth — body JSON (credenciales en payload)</option>
              <option value="bearer+basic"  ${at==='bearer+basic' ?'selected':''}>Bearer + Basic body (token en header + credenciales en payload)</option>
              <option value="apikey"        ${at==='apikey'       ?'selected':''}>API Key (header personalizado)</option>
              <option value="custom-headers" ${at==='custom-headers'?'selected':''}>Headers personalizados ✦</option>
            </select>
          </div>
          <div id="oe-sect-none" style="${show('none')}">
            <div style="font-size:13px;color:var(--text3);padding:12px 14px;border-radius:8px;border:1px dashed var(--border)">No se enviará ningún header de autenticación.</div>
          </div>
          <div id="oe-sect-bearer" style="${(at==='bearer'||at==='bearer+basic')?'display:grid':'display:none'};gap:12px">
            <div>
              <label class="label">Token</label>
              <div style="position:relative">
                <input class="input mono" id="oe-auth-token" type="password" autocomplete="new-password" placeholder="eyJhbGciOiJIUzI1NiIsInR5..." value="${escHtml(a.token||'')}" style="padding-right:40px"/>
                ${_eyeBtn('oe-auth-token')}
              </div>
              <div class="sub" style="margin-top:6px">Header: <code style="color:var(--sky);font-size:11px">Authorization: Bearer &lt;token&gt;</code></div>
            </div>
          </div>
          <div id="oe-sect-basic" style="${(at==='basic'||at==='basic-in-body'||at==='bearer+basic')?'display:grid':'display:none'};gap:12px;grid-template-columns:1fr 1fr">
            <div><label class="label">Usuario</label><input class="input" id="oe-auth-username" autocomplete="new-password" placeholder="usuario_api" value="${escHtml(a.username||'')}"/></div>
            <div><label class="label">Contraseña</label><div style="position:relative"><input class="input" id="oe-auth-password" type="password" autocomplete="new-password" placeholder="••••••••" value="${escHtml(a.password||'')}" style="padding-right:40px"/>${_eyeBtn('oe-auth-password')}</div></div>
            <div id="oe-basic-note" style="grid-column:span 2" class="sub">${at==='basic-in-body'
              ? 'Credenciales enviadas dentro del JSON del payload (no en el header)'
              : at==='bearer+basic'
                ? 'Credenciales en el payload + Bearer token en el header'
                : '<code style=\'color:var(--sky);font-size:11px\'>Authorization: Basic base64(usuario:contraseña)</code>'
            }</div>
          </div>
          <div id="oe-sect-apikey" style="${show('apikey')};gap:12px;grid-template-columns:200px 1fr">
            <div><label class="label">Nombre del header</label><input class="input mono" id="oe-auth-header" placeholder="X-Api-Key" value="${escHtml(a.header||'X-Api-Key')}"/></div>
            <div><label class="label">Valor</label><div style="position:relative"><input class="input mono" id="oe-auth-apikey-value" type="password" autocomplete="new-password" placeholder="tu_api_key_aqui" value="${escHtml(a.value||'')}" style="padding-right:40px"/>${_eyeBtn('oe-auth-apikey-value')}</div></div>
            <div style="grid-column:span 2" class="sub">Header: <code style="color:var(--sky);font-size:11px">&lt;header&gt;: &lt;valor&gt;</code></div>
          </div>

          <!-- CUSTOM HEADERS -->
          <div id="oe-sect-custom-headers" style="${at==='custom-headers'?'display:block':'display:none'}">
            <div class="label" style="margin-bottom:6px">Headers HTTP personalizados</div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
              Define los headers que requiere la API del destino (nombre y valor).
            </div>
            <div id="oe-ch-list-${id}" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
              ${_renderCustomHeadersList(id, a.headers||[])}
            </div>
            <button class="btn sm primary" onclick="orgAuthHeaderAdd('${id}')">+ Agregar header</button>
          </div>

        </div>
      </div>

      <!-- MAPEO DE CAMPOS -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Mapeo de campos GPS</h3>
            <div class="sub" style="margin-top:3px">Define qué datos se envían y cómo se llaman en el JSON</div>
          </div>
          <div style="display:flex;gap:6px">
            <!-- Botón Plantilla -->
            <div style="position:relative">
              <button class="btn sm" id="btn-tpl-${id}"
                onclick="_openTplMenu(this,'tpl-menu-${id}')"
                style="gap:5px">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Plantilla
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div id="tpl-menu-${id}" style="display:none;position:absolute;top:calc(100% + 4px);right:0;
                background:var(--bg1);border:1px solid var(--border);border-radius:10px;
                box-shadow:0 8px 24px rgba(0,0,0,.35);min-width:280px;z-index:999;overflow:hidden">
                <div style="padding:10px 14px;font-size:11px;font-weight:700;color:var(--text2);
                  text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);
                  background:var(--surface)">
                  Plantillas de campos GPS
                </div>
                ${Object.entries(GPS_TEMPLATES).map(([key, tpl]) => `
                  <button onclick="orgApplyTemplate('${id}','${key}');document.getElementById('tpl-menu-${id}').style.display='none'"
                    style="display:block;width:100%;text-align:left;padding:11px 14px;background:transparent;
                      border:none;cursor:pointer;border-bottom:1px solid var(--border);font-family:inherit;
                      transition:background .12s"
                    onmouseenter="this.style.background='rgba(255,255,255,.08)'" onmouseleave="this.style.background='transparent'">
                    <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${tpl.label}</div>
                    <div style="font-size:11px;color:var(--text3)">${tpl.description} · ${tpl.fields.length} campos</div>
                  </button>`).join('')}
                <button onclick="orgClearFields('${id}');document.getElementById('tpl-menu-${id}').style.display='none'"
                  style="display:block;width:100%;text-align:left;padding:11px 14px;background:none;
                    border:none;cursor:pointer;font-family:inherit;color:var(--red);transition:background .12s"
                  onmouseenter="this.style.background='var(--red-dim)'" onmouseleave="this.style.background='transparent'">
                  <div style="font-size:12px;font-weight:600">Limpiar todos los campos</div>
                </button>
              </div>
            </div>
            <button class="btn sm primary" onclick="orgAddField('${id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar campo
            </button>
          </div>
        </div>
        <div class="card-body" style="display:grid;gap:0">
          <div class="source-legend">
            <span style="font-size:11px;color:var(--text3);align-self:center">Fuentes:</span>
            <span class="source-legend-item src-gps">📡 GPS — del dispositivo</span>
            <span class="source-legend-item src-unit">🏢 Unidad / Cliente</span>
            <span class="source-legend-item src-fixed">✏️ Valor fijo</span>
          </div>
          <div class="field-row-grid" style="padding:4px 6px 8px;border-bottom:1px solid var(--border);margin-bottom:2px">
            ${['','Clave API (JSON)','Etiqueta','Fuente de datos','Req.',''].map(h=>
              `<div style="font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:var(--text3)">${h}</div>`
            ).join('')}
          </div>
          <div id="fields-list-${id}" style="display:grid;gap:4px;max-height:400px;overflow-y:auto;padding-right:2px"></div>
          ${!(org.fields||[]).length ? `<div style="text-align:center;padding:28px;color:var(--text3);font-size:13px">Sin campos. Usa "Plantilla" para configurar rápidamente o "Agregar campo" para hacerlo manual.</div>` : ''}
        </div>
      </div>

      <!-- VISTA PREVIA DEL PAYLOAD -->
      <div class="card">
        <div class="card-header">
          <h3>Vista previa del payload GPS</h3>
          <span class="badge sky">JSON que se enviará al destino</span>
        </div>
        <div class="card-body">
          <pre id="payload-preview-${id}" class="payload-preview"></pre>
        </div>
      </div>

    </div>`;

  renderFieldsList(id);
  renderPayloadPreview(id);
}

// ── renderFieldsList — con las 3 categorías de fuente ─────────────────────────
function renderFieldsList(orgId) {
  const org       = ORGS[orgId];
  const container = document.getElementById('fields-list-'+orgId);
  if (!container) return;
  const fields = [...(org.fields||[])].sort((a,b)=>a.order-b.order);
  container.innerHTML = '';

  fields.forEach(f => {
    const sourceVal = f.source || '';
    const isFixed   = sourceVal === 'fixed';
    const srcInfo   = GPS_SOURCES.find(s => s.value === sourceVal);
    const srcClass  = srcInfo?.group === 'GPS'    ? 'src-gps'   :
                      srcInfo?.group === 'Unidad' ? 'src-unit'  :
                      srcInfo?.group === 'Fijo'   ? 'src-fixed' : '';

    const row = document.createElement('div');
    row.dataset.fid = f.id;
    row.className   = 'field-row-grid';
    row.innerHTML = `
      <span class="drag-handle" title="Arrastrar para reordenar">⠿</span>
      <input class="input mono" style="font-size:12px" value="${escHtml(f.apiKey)}"
        placeholder="campo_json"
        oninput="orgFieldChange('${orgId}','${f.id}','apiKey',this.value)" />
      <input class="input" style="font-size:12px" value="${escHtml(f.label)}"
        placeholder="Etiqueta"
        oninput="orgFieldChange('${orgId}','${f.id}','label',this.value)" />
      <div style="display:grid;gap:4px">
        <select class="input ${srcClass}" style="font-size:12px"
          onchange="orgFieldSourceChange('${orgId}','${f.id}',this.value,this)">
          ${_buildSourceOptions(sourceVal)}
        </select>
        ${isFixed ? `
          <input class="input" style="font-size:12px" value="${escHtml(f.fixedValue||'')}"
            placeholder="Valor fijo (se envía igual a todas las unidades)"
            oninput="orgFieldChange('${orgId}','${f.id}','fixedValue',this.value)" />
        ` : ''}
      </div>
      <button class="req-toggle ${f.required?'on':''}"
        onclick="orgToggleRequired('${orgId}','${f.id}',this)">
        ${f.required ? '✓ Req' : 'Opcional'}
      </button>
      <button class="btn sm danger" style="padding:4px" onclick="orgRemoveField('${orgId}','${f.id}')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    container.appendChild(row);
  });

  renderPayloadPreview(orgId);
  _initDragSort(orgId);  // activar drag & drop
}

// ── Drag & drop nativo HTML5 para reordenar campos ────────────────
function _initDragSort(orgId) {
  const container = document.getElementById('fields-list-'+orgId);
  if (!container) return;
  let dragSrc = null;

  container.querySelectorAll('[data-fid]').forEach(row => {
    row.setAttribute('draggable', 'true');

    row.addEventListener('dragstart', function(e) {
      dragSrc = this;
      this.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragend', function() {
      this.style.opacity = '1';
      container.querySelectorAll('[data-fid]').forEach(r => {
        r.style.borderTop = '';
        r.style.borderBottom = '';
      });
    });

    row.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (this === dragSrc) return;
      // Indicador visual
      container.querySelectorAll('[data-fid]').forEach(r => {
        r.style.borderTop = '';
        r.style.borderBottom = '';
      });
      this.style.borderTop = '2px solid var(--sky)';
      return false;
    });

    row.addEventListener('dragleave', function() {
      this.style.borderTop = '';
      this.style.borderBottom = '';
    });

    row.addEventListener('drop', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (dragSrc === this) return;

      // Reordenar en el modelo
      const org    = ORGS[orgId];
      const srcFid = dragSrc.dataset.fid;
      const dstFid = this.dataset.fid;
      const fields = [...(org.fields||[])].sort((a,b)=>a.order-b.order);
      const srcIdx = fields.findIndex(f=>f.id===srcFid);
      const dstIdx = fields.findIndex(f=>f.id===dstFid);
      if (srcIdx < 0 || dstIdx < 0) return;

      // Mover el elemento
      const [moved] = fields.splice(srcIdx, 1);
      fields.splice(dstIdx, 0, moved);

      // Reasignar order
      fields.forEach((f, i) => { f.order = i + 1; });
      org.fields = fields;

      _saveFieldsToAPI(orgId);
      renderFieldsList(orgId);
      return false;
    });
  });
}

// Cambio de fuente — mostrar/ocultar campo de valor fijo
function orgFieldSourceChange(orgId, fid, newSource, selectEl) {
  orgFieldChange(orgId, fid, 'source', newSource);
  // Actualizar color del select
  const srcInfo = GPS_SOURCES.find(s => s.value === newSource);
  selectEl.className = selectEl.className
    .replace(/\bsrc-\w+/g, '')
    .trim();
  const cls = srcInfo?.group === 'GPS'    ? 'src-gps'  :
              srcInfo?.group === 'Unidad' ? 'src-unit' :
              srcInfo?.group === 'Fijo'   ? 'src-fixed': '';
  if (cls) selectEl.classList.add(cls);
  // Re-renderizar para mostrar/ocultar input de valor fijo
  renderFieldsList(orgId);
}

// ── Vista previa del payload ──────────────────────────────────────────────────
function renderPayloadPreview(orgId) {
  const org     = ORGS[orgId];
  const preview = document.getElementById('payload-preview-'+orgId);
  if (!preview) return;

  const fields = [...(org.fields||[])].sort((a,b)=>a.order-b.order).filter(f => f.apiKey);

  const EXAMPLE = {
    lat: -32.8415, lon: -71.2148, speed: 85, heading: 270,
    ignition: true, ignition01: 1, wialon_ts: new Date().toISOString(),
    fecha_hora:  (() => { const d=new Date(),p=n=>String(n).padStart(2,'0'); return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; })(),
    fecha_slash: (() => { const d=new Date(),p=n=>String(n).padStart(2,'0'); return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; })(),
    alt: 1250.5, sats: 14, hdop: 0.8, odometro: 104999,
    unit_plate: 'TDCD29', unit_imei: '869671077365722',
    unit_name:  'Simantec', unit_rut: '76.123.456-7',
    cliente_nombre: 'Minera Los Pelambres', cliente_rut: '96.521.450-1',
  };

  if (!fields.length) {
    preview.textContent = '// Sin campos configurados\n// Usa "Plantilla" para configurar rápidamente';
    return;
  }

  const obj = {};
  fields.forEach(f => {
    if (f.source === 'fixed') {
      obj[f.apiKey] = f.fixedValue || '(valor fijo sin definir)';
    } else if (f.source && EXAMPLE[f.source] !== undefined) {
      obj[f.apiKey] = EXAMPLE[f.source];
    } else {
      obj[f.apiKey] = f.source ? `(${_gpsSourceLabel(f.source)})` : null;
    }
  });

  preview.textContent = JSON.stringify(obj, null, 2);
}

// ── CRUD de campos ────────────────────────────────────────────────────────────
function orgAddField(orgId) {
  const org = ORGS[orgId];
  const maxOrder = Math.max(0, ...(org.fields||[]).map(f=>f.order));
  const newId = 'f' + Date.now();
  org.fields = [...(org.fields||[]), {
    id: newId, apiKey: '', label: 'Nuevo campo',
    source: '', fixedValue: '', type: 'text', required: false, order: maxOrder+1,
  }];
  _saveFieldsToAPI(orgId);
  renderFieldsList(orgId);
  renderPayloadPreview(orgId);
  // Scroll al nuevo campo y focus en su input apiKey
  setTimeout(() => {
    const container = document.getElementById('fields-list-'+orgId);
    if (container) {
      container.scrollTop = container.scrollHeight;
      // Focus en el input apiKey del último campo
      const lastRow = container.lastElementChild;
      if (lastRow) {
        const inp = lastRow.querySelector('input');
        if (inp) inp.focus();
      }
    }
  }, 50);
}

function orgRemoveField(orgId, fid) {
  ORGS[orgId].fields = (ORGS[orgId].fields||[]).filter(f=>f.id!==fid);
  _saveFieldsToAPI(orgId);
  renderFieldsList(orgId);
  renderPayloadPreview(orgId);
}

function orgFieldChange(orgId, fid, key, val) {
  const f = (ORGS[orgId].fields||[]).find(f=>f.id===fid);
  if (f) { f[key]=val; _saveFieldsToAPI(orgId); renderPayloadPreview(orgId); }
}

function orgToggleRequired(orgId, fid, btn) {
  const f = (ORGS[orgId].fields||[]).find(f=>f.id===fid);
  if (!f) return;
  f.required = !f.required;
  btn.textContent = f.required ? '✓ Req' : 'Opcional';
  btn.classList.toggle('on', f.required);
  _saveFieldsToAPI(orgId);
  renderPayloadPreview(orgId);
}

async function _saveFieldsToAPI(orgId) {
  try { await api.patch(`/destinations/${orgId}`, { field_schema: ORGS[orgId].fields }); } catch(_) {}
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function orgAuthTypeChange(id) {
  const type = document.getElementById('oe-auth-type')?.value || 'none';

  // Determinar qué paneles mostrar según el tipo seleccionado
  // basic-in-body → muestra el panel basic (mismos campos: usuario + contraseña)
  // bearer+basic  → muestra bearer (token) + basic (usuario + contraseña)
  const showBearer = type === 'bearer' || type === 'bearer+basic';
  const showBasic  = type === 'basic'  || type === 'basic-in-body' || type === 'bearer+basic';
  const showApikey = type === 'apikey';
  const showNone   = type === 'none';

  const showCustom = type === 'custom-headers';
  const vis = {
    none:           showNone   ? 'block' : 'none',
    bearer:         showBearer ? 'grid'  : 'none',
    basic:          showBasic  ? 'grid'  : 'none',
    apikey:         showApikey ? 'grid'  : 'none',
    'custom-headers': showCustom ? 'block' : 'none',
  };
  Object.entries(vis).forEach(([t, d]) => {
    const el = document.getElementById('oe-sect-'+t);
    if (el) el.style.display = d;
  });

  // Actualizar la nota descriptiva en el panel basic según el subtipo
  const note = document.getElementById('oe-basic-note');
  if (note) {
    if (type === 'basic-in-body') {
      note.innerHTML = 'Credenciales enviadas dentro del JSON del payload (no en el header HTTP)';
    } else if (type === 'bearer+basic') {
      note.innerHTML = 'Usuario/contraseña van dentro del payload JSON, el token va en el header';
    } else {
      note.innerHTML = 'Header: <code style="color:var(--sky);font-size:11px">Authorization: Basic base64(usuario:contraseña)</code>';
    }
  }

  const badge = document.getElementById('oe-auth-badge');
  if (badge) { badge.textContent=_authLabel(type); badge.style.cssText=_authBadgeStyle(type); }

  // Guardar el tipo en ORGS
  if (ORGS[id]) {
    const prev = ORGS[id].auth || {};
    // Si cambia a custom-headers, inicializar array de headers vacío si no existe
    const headers = type === 'custom-headers'
      ? (Array.isArray(prev.headers) ? prev.headers : [])
      : prev.headers;
    ORGS[id].auth = { ...prev, type, ...(headers !== undefined ? { headers } : {}) };
    _saveAuthToAPI(id);
  }
}

function _readAuthFromForm() {
  const type = document.getElementById('oe-auth-type')?.value || 'none';
  if (type === 'none') return null;
  if (type === 'bearer') return {
    type: 'bearer',
    token: document.getElementById('oe-auth-token')?.value?.trim() || '',
  };
  if (type === 'basic' || type === 'basic-in-body') return {
    type,
    username: document.getElementById('oe-auth-username')?.value?.trim() || '',
    password: document.getElementById('oe-auth-password')?.value || '',
  };
  if (type === 'bearer+basic') return {
    type: 'bearer+basic',
    token:    document.getElementById('oe-auth-token')?.value?.trim() || '',
    username: document.getElementById('oe-auth-username')?.value?.trim() || '',
    password: document.getElementById('oe-auth-password')?.value || '',
  };
  if (type === 'apikey') return {
    type:   'apikey',
    header: document.getElementById('oe-auth-header')?.value?.trim() || 'X-Api-Key',
    value:  document.getElementById('oe-auth-apikey-value')?.value?.trim() || '',
  };
  if (type === 'custom-headers') {
    // Leer el array de headers desde ORGS (se mantiene en memoria al editar)
    const orgId = activeOrgId;
    return {
      type: 'custom-headers',
      headers: (ORGS[orgId]?.auth?.headers || []).filter(h => h.key),
    };
  }
  return null;
}

function _validateAuth(auth) {
  if (!auth) return null;
  if (auth.type==='bearer' && !auth.token) return 'Ingresa el token Bearer.';
  if (auth.type==='basic' && (!auth.username||!auth.password)) return 'Ingresa usuario y contraseña.';
  if (auth.type==='apikey' && !auth.value) return 'Ingresa el valor del API Key.';
  return null;
}

async function orgSaveMeta(id) {
  const nameVal=document.getElementById('oe-name')?.value.trim();
  const urlVal=document.getElementById('oe-url')?.value.trim();
  const colorVal=document.getElementById('oe-color')?.value;
  const auth=_readAuthFromForm();
  if (!nameVal) { showToast('Error','El nombre no puede estar vacío.'); return; }
  const authErr=_validateAuth(auth); if (authErr) { showToast('Error',authErr); return; }
  ORGS[id].name=nameVal; ORGS[id].apiUrl=urlVal||''; ORGS[id].color=colorVal||'#38bdf8'; ORGS[id].auth=auth;
  try {
    await api.patch(`/destinations/${id}`, { ...orgToDestPatch(ORGS[id]), auth });
    const fb=document.getElementById('oe-save-feedback');
    if (fb) { fb.style.display='flex'; clearTimeout(fb._timer); fb._timer=setTimeout(()=>fb.style.display='none',2500); }
    showToast('Guardado',`"${nameVal}" actualizado.`);
    renderOrgList();
  } catch(_) {}
}

// ── Delete ────────────────────────────────────────────────────────────────────
function orgDeletePrompt(id) {
  const w=document.getElementById('del-confirm-'+id); if(!w)return;
  w.innerHTML=`<span style="font-size:12px;color:var(--text2)">¿Confirmar eliminación?</span>
    <button class="btn sm danger" onclick="orgDeleteConfirm('${id}')">Sí, eliminar</button>
    <button class="btn sm" onclick="orgDeleteCancel('${id}')">Cancelar</button>`;
}
function orgDeleteCancel(id) {
  const w=document.getElementById('del-confirm-'+id); if(!w)return;
  w.innerHTML=`<button class="btn sm danger" onclick="orgDeletePrompt('${id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg> Eliminar</button>`;
}
async function orgDeleteConfirm(id) {
  try {
    await api.delete(`/destinations/${id}`);
    delete ORGS[id]; activeOrgId=null; renderOrgList();
    document.getElementById('org-editor').innerHTML=`<div class="empty-state" style="padding:80px 20px"><p>Organización eliminada</p></div>`;
    showToast('Eliminado','La organización fue eliminada.');
  } catch(_) {}
}

function orgClose() {
  activeOrgId=null; renderOrgList();
  document.getElementById('org-editor').innerHTML=`
    <div class="empty-state" style="padding:80px 20px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;margin-bottom:14px;opacity:.3"><path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>
      <p>Selecciona o crea una organización</p>
      <small>Define el mapeo de campos GPS y URL de API para cada destino</small>
    </div>`;
}

// Cerrar menú de plantillas al hacer click fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('[id^="tpl-menu-"]') && !e.target.closest('[id^="btn-tpl-"]'))
    document.querySelectorAll('[id^="tpl-menu-"]').forEach(m => m.style.display='none');
});
