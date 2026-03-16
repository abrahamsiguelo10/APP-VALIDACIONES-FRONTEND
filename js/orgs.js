/**
 * orgs.js — Gestión de organizaciones/destinos conectada a la API
 * Depende de: api.js, store.js
 */

let activeOrgId = null;

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    const hasAuth = !!(org.auth && org.auth.type && org.auth.type !== 'none');
    const el = document.createElement('div');
    el.className = 'nav-item' + (id === activeOrgId ? ' active' : '');
    el.style.cssText = 'gap:10px;padding:8px 10px';
    el.innerHTML = `
      <span style="width:8px;height:8px;border-radius:99px;background:${org.color||'var(--sky)'};flex-shrink:0;display:inline-block"></span>
      <span style="flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${org.name}</span>
      ${hasAuth ? `<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(52,211,153,.15);color:var(--green);font-weight:500">auth</span>` : ''}
      <span style="font-size:11px;color:var(--text3)">${(org.fields||[]).length} campos</span>`;
    el.onclick = () => { activeOrgId = id; renderOrgList(); renderOrgEditor(id); };
    list.appendChild(el);
  });
}

async function orgNew() {
  const id   = 'org-' + Date.now();
  const body = { id, name: 'Nueva organización', api_url: '', color: '#34d399', field_schema: [] };
  try {
    await api.post('/destinations', body);
    ORGS[id] = destToOrg({ ...body, field_schema: [] });
    activeOrgId = id;
    await renderOrgList();
    renderOrgEditor(id);
  } catch (_) {}
}

function _eyeBtn(targetId) {
  return `<button type="button" onclick="(function(b){var i=document.getElementById('${targetId}');if(!i)return;var s=i.type==='password';i.type=s?'text':'password';b.style.opacity=s?'1':'.4';})(this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:var(--text3);display:flex;align-items:center;opacity:.4">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  </button>`;
}

function _authLabel(t) {
  return {none:'Sin auth',bearer:'Bearer Token',basic:'Basic Auth',apikey:'API Key'}[t]||t;
}
function _authBadgeStyle(t) {
  if(t==='bearer') return 'background:rgba(99,102,241,.15);color:#818cf8;border:none';
  if(t==='basic')  return 'background:rgba(52,211,153,.15);color:var(--green);border:none';
  if(t==='apikey') return 'background:rgba(251,191,36,.15);color:#f59e0b;border:none';
  return 'background:var(--bg2);color:var(--text3);border:none';
}

function renderOrgEditor(id) {
  const org  = ORGS[id];
  if (!org) return;
  const a    = org.auth || {};
  const at   = a.type || 'none';
  const show = t => `display:${at===t ? (t==='none'?'block':'grid') : 'none'}`;

  document.getElementById('org-editor').innerHTML = `
    <div style="display:grid;gap:16px">

      <!-- IDENTIDAD -->
      <div class="card">
        <div class="card-header">
          <h3>Identidad de la organización</h3>
          <div id="del-confirm-${id}" style="display:flex;gap:6px;align-items:center">
            <button class="btn sm danger" onclick="orgDeletePrompt('${id}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              Eliminar
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
          <div style="font-size:12px;color:var(--text3);padding:8px 12px;border-radius:6px;background:var(--bg2);line-height:1.6">
            <strong style="color:var(--text2)">Multi-destino:</strong>
            Una unidad puede enviar datos a más de una organización simultáneamente. Cada organización recibe el mismo paquete GPS de forma independiente, con su propia URL y credenciales. Configura las asignaciones en <strong style="color:var(--text2)">Patentes / IMEI</strong>.
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div id="oe-save-feedback" style="font-size:12px;color:var(--green);display:none;align-items:center;gap:5px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Cambios guardados
            </div>
            <button class="btn primary" style="margin-left:auto" onclick="orgSaveMeta('${id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Guardar cambios
            </button>
            <button class="btn sm" onclick="orgClose()" title="Cerrar" style="padding:4px 8px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- AUTENTICACIÓN -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Autenticación de la API</h3>
            <div class="sub" style="margin-top:3px">Credenciales enviadas en cada solicitud GPS a este destino</div>
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

          <!-- Sin auth -->
          <div id="oe-sect-none" style="${show('none')}">
            <div style="font-size:13px;color:var(--text3);padding:12px 14px;border-radius:8px;border:1px dashed var(--border)">
              No se enviará ningún header de autenticación.
            </div>
          </div>

          <!-- Bearer -->
          <div id="oe-sect-bearer" style="${show('bearer')};gap:12px">
            <div>
              <label class="label">Token</label>
              <div style="position:relative">
                <input class="input mono" id="oe-auth-token" type="password" autocomplete="new-password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5..." value="${escHtml(a.token||'')}" style="padding-right:40px"/>
                ${_eyeBtn('oe-auth-token')}
              </div>
              <div class="sub" style="margin-top:6px">Header enviado: <code style="color:var(--sky);font-size:11px">Authorization: Bearer &lt;token&gt;</code></div>
            </div>
          </div>

          <!-- Basic -->
          <div id="oe-sect-basic" style="${show('basic')};gap:12px;grid-template-columns:1fr 1fr">
            <div>
              <label class="label">Usuario</label>
              <input class="input" id="oe-auth-username" autocomplete="new-password"
                placeholder="usuario_api" value="${escHtml(a.username||'')}"/>
            </div>
            <div>
              <label class="label">Contraseña</label>
              <div style="position:relative">
                <input class="input" id="oe-auth-password" type="password" autocomplete="new-password"
                  placeholder="••••••••" value="${escHtml(a.password||'')}" style="padding-right:40px"/>
                ${_eyeBtn('oe-auth-password')}
              </div>
            </div>
            <div style="grid-column:span 2" class="sub">Header enviado: <code style="color:var(--sky);font-size:11px">Authorization: Basic base64(usuario:contraseña)</code></div>
          </div>

          <!-- API Key -->
          <div id="oe-sect-apikey" style="${show('apikey')};gap:12px;grid-template-columns:200px 1fr">
            <div>
              <label class="label">Nombre del header</label>
              <input class="input mono" id="oe-auth-header"
                placeholder="X-Api-Key" value="${escHtml(a.header||'X-Api-Key')}"/>
              <div class="sub" style="margin-top:4px">Ej: X-Api-Key, X-Token, Api-Key</div>
            </div>
            <div>
              <label class="label">Valor</label>
              <div style="position:relative">
                <input class="input mono" id="oe-auth-apikey-value" type="password" autocomplete="new-password"
                  placeholder="tu_api_key_aqui" value="${escHtml(a.value||'')}" style="padding-right:40px"/>
                ${_eyeBtn('oe-auth-apikey-value')}
              </div>
            </div>
            <div style="grid-column:span 2" class="sub">Header enviado: <code style="color:var(--sky);font-size:11px">&lt;header&gt;: &lt;valor&gt;</code></div>
          </div>

        </div>
      </div>

      <!-- MAPEO DE CAMPOS -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Mapeo de campos</h3>
            <div class="sub" style="margin-top:3px">Define qué campos de la API se muestran y en qué orden</div>
          </div>
          <button class="btn sm primary" onclick="orgAddField('${id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar campo
          </button>
        </div>
        <div class="card-body" style="display:grid;gap:0">
          <div style="display:grid;grid-template-columns:26px 1fr 1fr 110px 80px 70px 36px;gap:6px;padding:6px 10px;margin-bottom:4px">
            <div></div>
            ${['Clave API','Etiqueta visible','Tipo','Validación','Requerido',''].map(h=>`<div style="font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--text3)">${h}</div>`).join('')}
          </div>
          <div id="fields-list-${id}" style="display:grid;gap:6px;max-height:340px;overflow-y:auto;padding-right:4px"></div>
          ${!(org.fields||[]).length?`<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px">Sin campos. Haz clic en "Agregar campo" para comenzar.</div>`:''}
        </div>
      </div>

      <!-- VISTA PREVIA -->
      <div class="card">
        <div class="card-header">
          <h3>Vista previa del formulario</h3>
          <span class="badge sky">Solo referencia visual</span>
        </div>
        <div class="card-body" id="schema-preview-${id}" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"></div>
      </div>

    </div>`;

  renderFieldsList(id);
  renderSchemaPreview(id);
}

function orgAuthTypeChange(id) {
  const type = document.getElementById('oe-auth-type')?.value || 'none';
  ['none','bearer','basic','apikey'].forEach(t => {
    const el = document.getElementById('oe-sect-' + t);
    if (el) el.style.display = t === type ? (t==='none'?'block':'grid') : 'none';
  });
  const badge = document.getElementById('oe-auth-badge');
  if (badge) { badge.textContent = _authLabel(type); badge.style.cssText = _authBadgeStyle(type); }
}

function _readAuthFromForm() {
  const type = document.getElementById('oe-auth-type')?.value || 'none';
  if (type === 'none')   return null;
  if (type === 'bearer') return { type:'bearer', token: document.getElementById('oe-auth-token')?.value?.trim()||'' };
  if (type === 'basic')  return { type:'basic',  username: document.getElementById('oe-auth-username')?.value?.trim()||'', password: document.getElementById('oe-auth-password')?.value||'' };
  if (type === 'apikey') return { type:'apikey', header: document.getElementById('oe-auth-header')?.value?.trim()||'X-Api-Key', value: document.getElementById('oe-auth-apikey-value')?.value?.trim()||'' };
  return null;
}

function _validateAuth(auth) {
  if (!auth) return null;
  if (auth.type==='bearer' && !auth.token)                    return 'Ingresa el token Bearer.';
  if (auth.type==='basic'  && (!auth.username||!auth.password)) return 'Ingresa usuario y contraseña.';
  if (auth.type==='apikey' && !auth.value)                    return 'Ingresa el valor del API Key.';
  return null;
}

async function orgSaveMeta(id) {
  const nameVal  = document.getElementById('oe-name')?.value.trim();
  const urlVal   = document.getElementById('oe-url')?.value.trim();
  const colorVal = document.getElementById('oe-color')?.value;
  const auth     = _readAuthFromForm();

  if (!nameVal) { showToast('Error','El nombre no puede estar vacío.'); document.getElementById('oe-name').focus(); return; }
  const authErr = _validateAuth(auth);
  if (authErr) { showToast('Error', authErr); return; }

  ORGS[id].name   = nameVal;
  ORGS[id].apiUrl = urlVal   || '';
  ORGS[id].color  = colorVal || '#38bdf8';
  ORGS[id].auth   = auth;

  try {
    await api.patch(`/destinations/${id}`, { ...orgToDestPatch(ORGS[id]), auth });
    const fb = document.getElementById('oe-save-feedback');
    if (fb) { fb.style.display='flex'; clearTimeout(fb._timer); fb._timer=setTimeout(()=>fb.style.display='none',2500); }
    showToast('Guardado', `"${nameVal}" actualizado correctamente.`);
    renderOrgList();
  } catch (_) {}
}

function orgDeletePrompt(id) {
  const wrap = document.getElementById('del-confirm-'+id);
  if (!wrap) return;
  wrap.innerHTML = `<span style="font-size:12px;color:var(--text2)">¿Confirmar eliminación?</span>
    <button class="btn sm danger" onclick="orgDeleteConfirm('${id}')">Sí, eliminar</button>
    <button class="btn sm" onclick="orgDeleteCancel('${id}')">Cancelar</button>`;
}
function orgDeleteCancel(id) {
  const wrap = document.getElementById('del-confirm-'+id);
  if (!wrap) return;
  wrap.innerHTML = `<button class="btn sm danger" onclick="orgDeletePrompt('${id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg> Eliminar</button>`;
}
async function orgDeleteConfirm(id) {
  try {
    await api.delete(`/destinations/${id}`);
    delete ORGS[id]; activeOrgId = null;
    renderOrgList();
    document.getElementById('org-editor').innerHTML = `<div class="empty-state" style="padding:80px 20px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;margin-bottom:14px;opacity:.3"><path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg><p>Organización eliminada</p><small>Crea una nueva o selecciona otra</small></div>`;
    showToast('Eliminado','La organización fue eliminada correctamente.');
  } catch (_) {}
}

function renderFieldsList(orgId) {
  const org = ORGS[orgId];
  const container = document.getElementById('fields-list-'+orgId);
  if (!container) return;
  const fields = [...(org.fields||[])].sort((a,b)=>a.order-b.order);
  container.innerHTML = '';
  fields.forEach(f => {
    const typeOpts  = FIELD_TYPES.map(t=>`<option value="${t}" ${f.type===t?'selected':''}>${t}</option>`).join('');
    const validOpts = ['none','email','rut','imei','patente-cl','number','min:0'].map(v=>`<option value="${v}" ${(f.validation||'none')===v?'selected':''}>${v}</option>`).join('');
    const row = document.createElement('div');
    row.className='field-row'; row.dataset.fid=f.id;
    row.innerHTML=`<span class="drag-handle" title="Reordenar">⠿</span>
      <input value="${escHtml(f.apiKey)}" placeholder="campo_api" onchange="orgFieldChange('${orgId}','${f.id}','apiKey',this.value)" />
      <input value="${escHtml(f.label)}" placeholder="Etiqueta" onchange="orgFieldChange('${orgId}','${f.id}','label',this.value)" />
      <select onchange="orgFieldChange('${orgId}','${f.id}','type',this.value)">${typeOpts}</select>
      <select onchange="orgFieldChange('${orgId}','${f.id}','validation',this.value)">${validOpts}</select>
      <button class="field-required-toggle ${f.required?'on':''}" onclick="orgToggleRequired('${orgId}','${f.id}',this)" title="${f.required?'Requerido':'Opcional'}">${f.required?'✓ Req':''}</button>
      <button class="btn sm danger" style="padding:4px 6px" onclick="orgRemoveField('${orgId}','${f.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    container.appendChild(row);
  });
  renderSchemaPreview(orgId);
}
function orgAddField(orgId) {
  const org=ORGS[orgId]; const maxOrder=Math.max(0,...(org.fields||[]).map(f=>f.order));
  org.fields=[...(org.fields||[]),{id:'f'+Date.now(),apiKey:'',label:'Nuevo campo',type:'text',required:false,order:maxOrder+1}];
  _saveFieldsToAPI(orgId); renderFieldsList(orgId);
}
function orgRemoveField(orgId,fid) { ORGS[orgId].fields=(ORGS[orgId].fields||[]).filter(f=>f.id!==fid); _saveFieldsToAPI(orgId); renderFieldsList(orgId); }
function orgFieldChange(orgId,fid,key,val) { const f=(ORGS[orgId].fields||[]).find(f=>f.id===fid); if(f){f[key]=val;_saveFieldsToAPI(orgId);renderSchemaPreview(orgId);} }
function orgToggleRequired(orgId,fid,btn) { const f=(ORGS[orgId].fields||[]).find(f=>f.id===fid); if(!f)return; f.required=!f.required; btn.classList.toggle('on',f.required); btn.textContent=f.required?'✓ Req':''; btn.title=f.required?'Requerido':'Opcional'; _saveFieldsToAPI(orgId); }
async function _saveFieldsToAPI(orgId) { try { await api.patch(`/destinations/${orgId}`,{field_schema:ORGS[orgId].fields}); } catch(_){} }

function renderSchemaPreview(orgId) {
  const org=ORGS[orgId]; const preview=document.getElementById('schema-preview-'+orgId);
  if(!preview)return;
  const fields=[...(org.fields||[])].sort((a,b)=>a.order-b.order).filter(f=>f.apiKey||f.label);
  if(!fields.length){preview.innerHTML='<div style="color:var(--text3);font-size:13px;grid-column:span 2">Sin campos definidos</div>';return;}
  preview.innerHTML=fields.map(f=>`<div><label class="label" style="display:flex;align-items:center;gap:5px">${escHtml(f.label||f.apiKey)}${f.required?'<span style="color:var(--red);font-size:10px">*</span>':''}<span style="margin-left:auto;font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${escHtml(f.apiKey)}</span></label>${f.type==='textarea'?`<textarea class="textarea" placeholder="${escHtml(f.label)}" disabled style="min-height:60px;opacity:.6"></textarea>`:f.type==='select'?`<select class="input" disabled style="opacity:.6"><option>– ${escHtml(f.label)} –</option></select>`:`<input class="input" placeholder="${escHtml(f.label)}" disabled style="opacity:.6" />`}</div>`).join('');
}
function orgClose() {
  activeOrgId = null;
  renderOrgList();
  document.getElementById('org-editor').innerHTML = `
    <div class="empty-state" style="padding:80px 20px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
        style="width:40px;height:40px;margin-bottom:14px;opacity:.3">
        <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
      </svg>
      <p>Selecciona o crea una organización</p>
      <small>Define el mapeo de campos y URL de API para cada cliente</small>
    </div>`;
}
