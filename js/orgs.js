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
function _authLabel(t) { return {none:'Sin auth',bearer:'Bearer Token',basic:'Basic Auth',apikey:'API Key'}[t]||t; }
function _authBadgeStyle(t) {
  if(t==='bearer') return 'background:rgba(99,102,241,.15);color:#818cf8;border:none';
  if(t==='basic')  return 'background:rgba(52,211,153,.15);color:var(--green);border:none';
  if(t==='apikey') return 'background:rgba(251,191,36,.15);color:#f59e0b;border:none';
  return 'background:var(--bg2);color:var(--text3);border:none';
}

function renderOrgEditor(id) {
  const org = ORGS[id];
  if (!org) return;
  const a = org.auth || {}, at = a.type || 'none';
  const show = t => `display:${at===t?(t==='none'?'block':'grid'):'none'}`;

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
              <option value="none"   ${at==='none'  ?'selected':''}>Sin autenticación</option>
              <option value="bearer" ${at==='bearer'?'selected':''}>Bearer Token</option>
              <option value="basic"  ${at==='basic' ?'selected':''}>Basic Auth (usuario / contraseña)</option>
              <option value="apikey" ${at==='apikey'?'selected':''}>API Key (header personalizado)</option>
            </select>
          </div>
          <div id="oe-sect-none" style="${show('none')}">
            <div style="font-size:13px;color:var(--text3);padding:12px 14px;border-radius:8px;border:1px dashed var(--border)">No se enviará ningún header de autenticación.</div>
          </div>
          <div id="oe-sect-bearer" style="${show('bearer')};gap:12px">
            <div>
              <label class="label">Token</label>
              <div style="position:relative">
                <input class="input mono" id="oe-auth-token" type="password" autocomplete="new-password" placeholder="eyJhbGciOiJIUzI1NiIsInR5..." value="${escHtml(a.token||'')}" style="padding-right:40px"/>
                ${_eyeBtn('oe-auth-token')}
              </div>
              <div class="sub" style="margin-top:6px">Header: <code style="color:var(--sky);font-size:11px">Authorization: Bearer &lt;token&gt;</code></div>
            </div>
          </div>
          <div id="oe-sect-basic" style="${show('basic')};gap:12px;grid-template-columns:1fr 1fr">
            <div><label class="label">Usuario</label><input class="input" id="oe-auth-username" autocomplete="new-password" placeholder="usuario_api" value="${escHtml(a.username||'')}"/></div>
            <div><label class="label">Contraseña</label><div style="position:relative"><input class="input" id="oe-auth-password" type="password" autocomplete="new-password" placeholder="••••••••" value="${escHtml(a.password||'')}" style="padding-right:40px"/>${_eyeBtn('oe-auth-password')}</div></div>
            <div style="grid-column:span 2" class="sub">Header: <code style="color:var(--sky);font-size:11px">Authorization: Basic base64(usuario:contraseña)</code></div>
          </div>
          <div id="oe-sect-apikey" style="${show('apikey')};gap:12px;grid-template-columns:200px 1fr">
            <div><label class="label">Nombre del header</label><input class="input mono" id="oe-auth-header" placeholder="X-Api-Key" value="${escHtml(a.header||'X-Api-Key')}"/></div>
            <div><label class="label">Valor</label><div style="position:relative"><input class="input mono" id="oe-auth-apikey-value" type="password" autocomplete="new-password" placeholder="tu_api_key_aqui" value="${escHtml(a.value||'')}" style="padding-right:40px"/>${_eyeBtn('oe-auth-apikey-value')}</div></div>
            <div style="grid-column:span 2" class="sub">Header: <code style="color:var(--sky);font-size:11px">&lt;header&gt;: &lt;valor&gt;</code></div>
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
                onclick="document.getElementById('tpl-menu-${id}').style.display=document.getElementById('tpl-menu-${id}').style.display==='block'?'none':'block'"
                style="gap:5px">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Plantilla
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div id="tpl-menu-${id}" style="display:none;position:absolute;top:calc(100% + 4px);right:0;
                background:var(--bg1);border:1px solid var(--border);border-radius:10px;
                box-shadow:0 8px 24px rgba(0,0,0,.35);min-width:280px;z-index:999;overflow:hidden">
                <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)">
                  Plantillas de campos GPS
                </div>
                ${Object.entries(GPS_TEMPLATES).map(([key, tpl]) => `
                  <button onclick="orgApplyTemplate('${id}','${key}');document.getElementById('tpl-menu-${id}').style.display='none'"
                    style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;cursor:pointer;border-bottom:1px solid var(--border);font-family:inherit"
                    onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background=''">
                    <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${tpl.label}</div>
                    <div style="font-size:11px;color:var(--text3)">${tpl.description} · ${tpl.fields.length} campos</div>
                  </button>`).join('')}
                <button onclick="orgClearFields('${id}');document.getElementById('tpl-menu-${id}').style.display='none'"
                  style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;cursor:pointer;font-family:inherit;color:var(--red)"
                  onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background=''">
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
          <!-- Leyenda de categorías -->
          <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:11px;color:var(--text3)">Tipos de fuente:</span>
            <span style="font-size:11px;padding:1px 8px;border-radius:4px;background:rgba(56,189,248,.1);color:var(--sky)">📡 GPS — automático del dispositivo</span>
            <span style="font-size:11px;padding:1px 8px;border-radius:4px;background:rgba(52,211,153,.1);color:var(--green)">🏢 Unidad/Cliente — de la base de datos</span>
            <span style="font-size:11px;padding:1px 8px;border-radius:4px;background:rgba(251,191,36,.1);color:#f59e0b">✏️ Fijo — valor constante</span>
          </div>
          <!-- Headers -->
          <div style="display:grid;grid-template-columns:24px 130px 120px 1fr 70px 32px;gap:6px;padding:5px 8px;margin-bottom:4px;border-bottom:1px solid var(--border)">
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
          <pre id="payload-preview-${id}" style="font-family:'DM Mono',monospace;font-size:12px;color:var(--sky);background:var(--bg2);padding:14px 16px;border-radius:8px;overflow-x:auto;margin:0;line-height:1.7"></pre>
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
    const sourceVal  = f.source || '';
    const isFixed    = sourceVal === 'fixed';
    const srcInfo    = GPS_SOURCES.find(s => s.value === sourceVal);
    const groupColor = srcInfo?.group === 'GPS' ? 'rgba(56,189,248,.15)' :
                       srcInfo?.group === 'Unidad' ? 'rgba(52,211,153,.15)' :
                       srcInfo?.group === 'Fijo'   ? 'rgba(251,191,36,.15)' : 'transparent';

    const row = document.createElement('div');
    row.dataset.fid = f.id;
    row.style.cssText = 'display:grid;grid-template-columns:24px 130px 120px 1fr 70px 32px;gap:6px;align-items:start;padding:5px 4px;border-bottom:1px solid var(--border)';
    row.innerHTML = `
      <span style="cursor:grab;color:var(--text3);text-align:center;padding-top:8px;font-size:13px">⠿</span>
      <input class="input" style="font-size:12px;font-family:monospace" value="${escHtml(f.apiKey)}"
        placeholder="campo_json"
        onchange="orgFieldChange('${orgId}','${f.id}','apiKey',this.value)" />
      <input class="input" style="font-size:12px" value="${escHtml(f.label)}"
        placeholder="Etiqueta"
        onchange="orgFieldChange('${orgId}','${f.id}','label',this.value)" />
      <div style="display:grid;gap:4px">
        <select class="input" style="font-size:12px;background:${groupColor}"
          onchange="orgFieldSourceChange('${orgId}','${f.id}',this.value,this)">
          ${_buildSourceOptions(sourceVal)}
        </select>
        ${isFixed ? `
          <input class="input" style="font-size:12px" value="${escHtml(f.fixedValue||'')}"
            placeholder="Valor constante..."
            onchange="orgFieldChange('${orgId}','${f.id}','fixedValue',this.value)"
            title="Este valor se enviará igual para todas las unidades" />
        ` : ''}
      </div>
      <button style="font-size:11px;padding:4px 4px;border-radius:6px;border:1px solid var(--border);
        background:${f.required?'rgba(56,189,248,.15)':'transparent'};
        color:${f.required?'var(--sky)':'var(--text3)'};cursor:pointer;width:100%;margin-top:2px"
        onclick="orgToggleRequired('${orgId}','${f.id}',this)">
        ${f.required ? '✓ Req' : 'Opcional'}
      </button>
      <button class="btn sm danger" style="padding:4px;margin-top:2px" onclick="orgRemoveField('${orgId}','${f.id}')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    container.appendChild(row);
  });

  renderPayloadPreview(orgId);
}

// Cambio de fuente — mostrar/ocultar campo de valor fijo
function orgFieldSourceChange(orgId, fid, newSource, selectEl) {
  orgFieldChange(orgId, fid, 'source', newSource);
  // Actualizar color del select
  const srcInfo = GPS_SOURCES.find(s => s.value === newSource);
  selectEl.style.background = srcInfo?.group === 'GPS'    ? 'rgba(56,189,248,.15)' :
                               srcInfo?.group === 'Unidad' ? 'rgba(52,211,153,.15)' :
                               srcInfo?.group === 'Fijo'   ? 'rgba(251,191,36,.15)' : 'transparent';
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
  org.fields = [...(org.fields||[]), {
    id: 'f'+Date.now(), apiKey: '', label: 'Nuevo campo',
    source: '', fixedValue: '', type: 'text', required: false, order: maxOrder+1,
  }];
  _saveFieldsToAPI(orgId);
  renderFieldsList(orgId);
}

function orgRemoveField(orgId, fid) {
  ORGS[orgId].fields = (ORGS[orgId].fields||[]).filter(f=>f.id!==fid);
  _saveFieldsToAPI(orgId);
  renderFieldsList(orgId);
}

function orgFieldChange(orgId, fid, key, val) {
  const f = (ORGS[orgId].fields||[]).find(f=>f.id===fid);
  if (f) { f[key]=val; _saveFieldsToAPI(orgId); renderPayloadPreview(orgId); }
}

function orgToggleRequired(orgId, fid, btn) {
  const f = (ORGS[orgId].fields||[]).find(f=>f.id===fid);
  if (!f) return;
  f.required = !f.required;
  btn.textContent      = f.required ? '✓ Req' : 'Opcional';
  btn.style.background = f.required ? 'rgba(56,189,248,.15)' : 'transparent';
  btn.style.color      = f.required ? 'var(--sky)' : 'var(--text3)';
  _saveFieldsToAPI(orgId);
}

async function _saveFieldsToAPI(orgId) {
  try { await api.patch(`/destinations/${orgId}`, { field_schema: ORGS[orgId].fields }); } catch(_) {}
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function orgAuthTypeChange(id) {
  const type = document.getElementById('oe-auth-type')?.value || 'none';
  ['none','bearer','basic','apikey'].forEach(t => {
    const el = document.getElementById('oe-sect-'+t);
    if (el) el.style.display = t===type ? (t==='none'?'block':'grid') : 'none';
  });
  const badge = document.getElementById('oe-auth-badge');
  if (badge) { badge.textContent=_authLabel(type); badge.style.cssText=_authBadgeStyle(type); }
}

function _readAuthFromForm() {
  const type = document.getElementById('oe-auth-type')?.value || 'none';
  if (type==='none')   return null;
  if (type==='bearer') return { type:'bearer', token: document.getElementById('oe-auth-token')?.value?.trim()||'' };
  if (type==='basic')  return { type:'basic', username: document.getElementById('oe-auth-username')?.value?.trim()||'', password: document.getElementById('oe-auth-password')?.value||'' };
  if (type==='apikey') return { type:'apikey', header: document.getElementById('oe-auth-header')?.value?.trim()||'X-Api-Key', value: document.getElementById('oe-auth-apikey-value')?.value?.trim()||'' };
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
