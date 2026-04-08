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
  if (document.getElementById('modal-cliente'))    document.getElementById('modal-cliente').value    = '';
  if (document.getElementById('modal-rut'))        document.getElementById('modal-rut').value        = '';


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
  const ds = document.getElementById('dest-search');
  if (ds) ds.value = '';
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
  .filter(f => (f.apiKey || f.label) && !['patente','imei'].includes((f.apiKey||'').toLowerCase()))
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
  const key   = f.apiKey || f.id;
  const attrs = `id="mf-${f.id}" data-apikey="${key}" ${f.required ? 'required' : ''}`;
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

document.getElementById('asignar-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('asignar-modal')) closeAsignarModal();
});

/* ══════════════════════════════════════════════════════════════
   VALIDADOR DE UNIDADES — v2
   ══════════════════════════════════════════════════════════════ */

let _valUnit      = null;   // unidad actual consultada
let _valGpsData   = null;   // { status, responses }
let _valMap       = null;   // instancia Leaflet
let _valMapLayers = [];     // polyline + markers actuales

/* ── Consultar ──────────────────────────────────────────────── */
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

  // Reset GPS data
  _valGpsData = null;
  try {
    // 1. Buscar unidad en BD
    const data = imei
      ? await api.get(`/units/${imei}`)
      : await api.get(`/units?search=${encodeURIComponent(patente)}`);

    _valUnit = imei ? data : (Array.isArray(data) ? data[0] : null);

    const panel = document.getElementById('result-panel');
    panel.classList.add('show');

    // Volver al tab de destinos
    switchValTab('destinos', document.querySelector('.val-tab'));

    if (!_valUnit) {
      _renderValNotFound(patente, imei);
      return;
    }

    // 2. Render datos básicos
    _renderValBasic(_valUnit);

    // 3. Cargar GPS en paralelo (no bloquea el render básico)
    _loadValGps(_valUnit.plate);

  } catch (_) {
    // api.js ya mostró toast
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Consultar';
  }
}

function _renderValNotFound(patente, imei) {
  document.getElementById('res-plate').textContent          = patente || '–';
  document.getElementById('res-imei').textContent           = 'IMEI: ' + (imei || '–');
  document.getElementById('res-cliente').textContent        = '–';
  document.getElementById('res-rut').textContent            = '–';
  document.getElementById('res-destinos-count').textContent = '0';
  document.getElementById('res-ping').textContent           = '–';
  document.getElementById('res-speed').textContent          = '–';
  document.getElementById('res-ignition').textContent       = '–';
  const badge = document.getElementById('res-status-badge');
  badge.textContent = 'No encontrado';
  badge.className   = 'badge red';
  document.getElementById('res-gps-badge').style.display   = 'none';
  document.getElementById('btn-export').style.display      = 'none';
  document.getElementById('btn-certificado').style.display = 'none';
  const _elDestNF = document.getElementById('res-destinos-list') || document.getElementById('res-destinos');
  if (_elDestNF) _elDestNF.innerHTML = '<span style="font-size:13px;color:var(--text2)">Unidad no registrada en el sistema.</span>';
  document.getElementById('res-historial-tbody').innerHTML = '';
  document.getElementById('res-historial-table').style.display  = 'none';
  document.getElementById('res-historial-empty').style.display  = '';
  document.getElementById('res-historial-loading').style.display = 'none';
  document.getElementById('tab-count-historial').textContent    = '';
}

function _renderValBasic(unit) {
  document.getElementById('res-plate').textContent          = unit.plate || '–';
  document.getElementById('res-imei').textContent           = 'IMEI: ' + unit.imei;
  document.getElementById('res-cliente').textContent        = unit.name || '–';
  document.getElementById('res-rut').textContent            = unit.rut  || '–';
  document.getElementById('res-destinos-count').textContent = (unit.destinations||[]).length;
  document.getElementById('res-ping').textContent           = 'Cargando…';
  document.getElementById('res-speed').textContent          = 'Cargando…';
  document.getElementById('res-ignition').textContent       = 'Cargando…';
  document.getElementById('btn-export').style.display       = '';
  document.getElementById('btn-certificado').style.display  = '';

  const badge = document.getElementById('res-status-badge');
  badge.textContent = unit.enabled ? 'Activo' : 'Inactivo';
  badge.className   = unit.enabled ? 'badge green' : 'badge red';

  const gpsBadge = document.getElementById('res-gps-badge');
  gpsBadge.textContent = 'GPS cargando…';
  gpsBadge.style.display = '';

  // Destinos
  const destList = document.getElementById('res-destinos-list') || document.getElementById('res-destinos');
  if (!(unit.destinations||[]).length) {
    destList.innerHTML = '<span style="font-size:13px;color:var(--text2)">Sin destinos asignados</span>';
  } else {
    destList.innerHTML = unit.destinations.map(d => `
      <span class="badge ${d.enabled ? 'sky' : 'amber'}" style="margin:2px">
        ${d.shadow ? '👁 ' : ''}${d.name}
      </span>`).join('');
  }

  // Historial — mostrar spinner mientras carga GPS
  document.getElementById('res-historial-loading').style.display  = '';
  document.getElementById('res-historial-table').style.display    = 'none';
  document.getElementById('res-historial-empty').style.display    = 'none';
  document.getElementById('tab-count-historial').textContent      = '';
  document.getElementById('res-mapa-nodata').style.display        = 'none';
}

async function _loadValGps(plate) {
  try {
    const data = await api.get(`/gps/admin?plate=${encodeURIComponent(plate)}`);
    _valGpsData = data;
    _renderValGps(data);
  } catch (e) {
    // GPS no disponible — rellenar con "–"
    document.getElementById('res-ping').textContent      = 'Sin datos GPS';
    document.getElementById('res-speed').textContent     = '–';
    document.getElementById('res-ignition').textContent  = '–';
    const gpsBadge = document.getElementById('res-gps-badge');
    gpsBadge.textContent = 'GPS sin datos';
    gpsBadge.className   = 'badge amber';
    document.getElementById('res-historial-loading').style.display = 'none';
    document.getElementById('res-historial-empty').style.display   = '';
  }
}

function _renderValGps({ status, responses }) {
  // — GPS badge / ping —
  const gpsBadge = document.getElementById('res-gps-badge');
  if (status?.isTransmitting && status?.tcpAgeMinutes != null) {
    const age = Math.round(status.tcpAgeMinutes);
    if (age < 20) {
      gpsBadge.textContent = `GPS OK · ${age} min`;
      gpsBadge.className   = 'badge green';
    } else if (age < 60) {
      gpsBadge.textContent = `GPS retrasado · ${age} min`;
      gpsBadge.className   = 'badge amber';
    } else {
      gpsBadge.textContent = 'GPS sin TX';
      gpsBadge.className   = 'badge red';
    }
    document.getElementById('res-ping').textContent = status.tcpLastAt
      ? new Date(status.tcpLastAt).toLocaleString('es-CL')
      : `${age} min atrás`;
  } else {
    gpsBadge.textContent = 'Sin transmisión';
  gpsBadge.className   = 'badge red';
  document.getElementById('res-ping').textContent     = '–';
  document.getElementById('res-speed').textContent    = '–';
  document.getElementById('res-ignition').textContent = '–';
  }

  // — Destinos: siempre al final, independiente del estado GPS —
  _renderValDestinos(status, responses);

  // — Último dato de posición — solo mostrar si hay transmisión activa —
  const results = responses?.results || [];
  const lastWithTx = results.find(r => r.tx?.lat && r.tx?.lon);

  if (status?.isTransmitting && lastWithTx?.tx) {
    const tx = lastWithTx.tx;
    document.getElementById('res-speed').textContent    = tx.speed != null ? `${tx.speed} km/h` : '–';
    document.getElementById('res-ignition').textContent = tx.ignition ? '🟢 Encendida' : '🔴 Apagada';
  } else if (!status?.isTransmitting) {
    // Sin transmisión — limpiar datos de velocidad e ignición
    document.getElementById('res-speed').textContent    = '–';
    document.getElementById('res-ignition').textContent = '–';
  }

  // — Historial tabla —
  _renderValHistorial(results);

  // — Mapa: todos los puntos con coordenadas válidas —
  const pointsWithCoords = results
    .filter(r => r.tx?.lat && r.tx?.lon)
    .map(r => r.tx);
  _renderValMapa(pointsWithCoords);
}

function _renderValHistorial(results) {
  const loading = document.getElementById('res-historial-loading');
  const table   = document.getElementById('res-historial-table');
  const empty   = document.getElementById('res-historial-empty');
  const tbody   = document.getElementById('res-historial-tbody');
  const count   = document.getElementById('tab-count-historial');

  loading.style.display = 'none';

  if (!results.length) {
    empty.style.display  = '';
    table.style.display  = 'none';
    count.textContent    = '';
    return;
  }

  count.textContent = results.length;
  table.style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = results.map(r => {
    const hora    = r.at ? new Date(r.at).toLocaleString('es-CL', { hour:'2-digit', minute:'2-digit', second:'2-digit', day:'2-digit', month:'2-digit' }) : '–';
    const dest    = r.destination_id || '–';
    const ok      = r.ok;
    const vel     = r.tx?.speed != null ? `${r.tx.speed} km/h` : '–';
    const ign     = r.tx?.ignition ? '🟢' : (r.tx?.ignition === false ? '🔴' : '–');
    // Respuesta: si es JSON con "message" mostrarlo, sino truncar
    let respText  = '–';
    try {
      const parsed = typeof r.response === 'string' ? JSON.parse(r.response) : r.response;
      respText = parsed?.message || parsed?.error || parsed?.status || JSON.stringify(parsed).slice(0, 60);
    } catch { respText = String(r.response || '–').slice(0, 60); }

    // ok === true → OK, ok === false → Error, ok === null → Sin envío
    const okClass = ok === true ? 'val-resp-ok' : ok === false ? 'val-resp-fail' : 'val-resp-pending';
    const okText  = ok === true ? '✓ OK'        : ok === false ? '✗ Error'       : '– Sin envío';

    return `<tr>
      <td class="mono">${hora}</td>
      <td>${dest}</td>
      <td><span class="${okClass}">${okText}</span></td>
      <td>${vel}</td>
      <td>${ign}</td>
      <td class="val-resp-text" title="${respText.replace(/"/g,'&quot;')}">${respText}</td>
    </tr>`;
  }).join('');
}

// points = array de tx objects ordenados del más reciente al más antiguo
function _renderValMapa(points) {
  const noData = document.getElementById('res-mapa-nodata');
  const mapDiv = document.getElementById('val-map');
  document.getElementById('res-mapa-ts').textContent = '';

  if (!points?.length) {
    noData.style.display = '';
    mapDiv.style.display = 'none';
    return;
  }

  noData.style.display = 'none';
  mapDiv.style.display = '';

  // Fecha del punto más reciente
  const latest = points[0];
  if (latest.fechaHoraISO || latest.time_epoch) {
    const d = latest.fechaHoraISO
      ? new Date(latest.fechaHoraISO)
      : new Date(latest.time_epoch * 1000);
    document.getElementById('res-mapa-ts').textContent =
      `Última posición: ${d.toLocaleString('es-CL')} · ${points.length} punto${points.length !== 1 ? 's' : ''}`;
  }

  // Inicializar mapa Leaflet una sola vez
  if (!_valMap) {
    _valMap = L.map('val-map', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(_valMap);
  }

  // Limpiar layers anteriores
  _valMapLayers.forEach(l => _valMap.removeLayer(l));
  _valMapLayers = [];

  // Coordenadas en orden cronológico (invertir — la API devuelve más reciente primero)
  const coords = [...points].reverse().map(p => [parseFloat(p.lat), parseFloat(p.lon)]);

  // Polyline de ruta
  const polyline = L.polyline(coords, {
    color: '#63b3ed',
    weight: 3,
    opacity: 0.7,
    dashArray: null,
  }).addTo(_valMap);
  _valMapLayers.push(polyline);

  // Puntos intermedios — círculos pequeños grises
  coords.slice(0, -1).forEach(([lat, lon], i) => {
    const tx = points[points.length - 1 - i];  // en orden cronológico
    const circle = L.circleMarker([lat, lon], {
      radius: 4,
      fillColor: '#94a3b8',
      color: '#fff',
      weight: 1,
      fillOpacity: 0.8,
    }).bindPopup(
      `Punto ${i + 1}<br>${lat.toFixed(5)}, ${lon.toFixed(5)}<br>` +
      (tx?.speed != null ? `${tx.speed} km/h ` : '') +
      (tx?.ignition ? '🟢' : tx?.ignition === false ? '🔴' : '')
    ).addTo(_valMap);
    _valMapLayers.push(circle);
  });

  // Marcador del punto más reciente — más grande y azul
  const lastLatLon = coords[coords.length - 1];
  const iconLatest = L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;background:#63b3ed;border:2.5px solid #fff;
      border-radius:50%;box-shadow:0 0 0 4px rgba(99,179,237,.4);
      position:relative">
      <div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);
        background:#1e293b;color:#e2e8f0;font-size:10px;font-weight:600;
        padding:1px 5px;border-radius:3px;white-space:nowrap;border:1px solid rgba(255,255,255,.15)">
        ${_valUnit?.plate || ''}
      </div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  const latestTx = points[0];
  const markerLatest = L.marker(lastLatLon, { icon: iconLatest })
    .addTo(_valMap)
    .bindPopup(
      `<b>${_valUnit?.plate || ''}</b> — Último punto<br>` +
      `${lastLatLon[0].toFixed(5)}, ${lastLatLon[1].toFixed(5)}<br>` +
      (latestTx.speed != null ? `${latestTx.speed} km/h ` : '') +
      (latestTx.ignition ? '🟢 Encendida' : latestTx.ignition === false ? '🔴 Apagada' : '')
    ).openPopup();
  _valMapLayers.push(markerLatest);

  // Ajustar zoom para mostrar toda la ruta
  _valMap.fitBounds(polyline.getBounds(), { padding: [30, 30], maxZoom: 15 });

  setTimeout(() => _valMap?.invalidateSize(), 50);
}

/* ── Tabs del validador ──────────────────────────────────────── */
function switchValTab(name, clickedBtn) {
  // Activar tab
  document.querySelectorAll('.val-tab').forEach(t => t.classList.remove('active'));
  if (clickedBtn) clickedBtn.classList.add('active');

  // Mostrar panel
  ['destinos','historial','mapa'].forEach(n => {
    document.getElementById(`val-panel-${n}`).style.display = n === name ? '' : 'none';
  });

  // Si es mapa, invalidar tamaño Leaflet
  if (name === 'mapa' && _valMap) {
    setTimeout(() => _valMap.invalidateSize(), 50);
  }
}

/* ── Exportar JSON — todo lo visible en pantalla ─────────────── */
function exportValidador() {
  if (!_valUnit) return;

  const gpsStatus = _valGpsData?.status;
  const results   = _valGpsData?.responses?.results || [];

  const payload = {
    exportado_en: new Date().toISOString(),
    unidad: {
      patente: _valUnit.plate   || null,
      imei:    _valUnit.imei    || null,
      cliente: _valUnit.name    || null,
      rut:     _valUnit.rut     || null,
      estado:  _valUnit.enabled ? 'activo' : 'inactivo',
    },
    estado_gps: {
      transmitiendo:      gpsStatus?.isTransmitting ?? null,
      ultimo_tcp:         gpsStatus?.tcpLastAt       || null,
      minutos_desde_ping: gpsStatus?.tcpAgeMinutes != null ? Math.round(gpsStatus.tcpAgeMinutes) : null,
    },
    destinos: (_valUnit.destinations || []).map(d => ({
      nombre: d.name    || null,
      estado: d.enabled ? 'activo' : 'inactivo',
      shadow: d.shadow  ?? false,
    })),
    historial_envios: results.map(r => {
      let respuesta = null;
      try { respuesta = typeof r.response === 'string' ? JSON.parse(r.response) : r.response; }
      catch { respuesta = r.response || null; }
      return {
        fecha:         r.at             || null,
        destino:       r.destination_id || null,
        ok:            r.ok             ?? null,
        velocidad_kmh: r.tx?.speed      ?? null,
        ignicion:      r.tx?.ignition   ?? null,
        lat:           r.tx?.lat        ?? null,
        lon:           r.tx?.lon        ?? null,
        respuesta,
      };
    }),
    ruta_gps: results
      .filter(r => r.tx?.lat && r.tx?.lon)
      .map((r, i) => ({
        punto:         i + 1,
        fecha:         r.tx.fechaHoraISO || (r.tx.time_epoch ? new Date(r.tx.time_epoch * 1000).toISOString() : null),
        lat:           r.tx.lat,
        lon:           r.tx.lon,
        velocidad_kmh: r.tx.speed    ?? null,
        ignicion:      r.tx.ignition ?? null,
      })),
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `validador_${_valUnit.plate || 'unidad'}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Limpiar ────────────────────────────────────────────────── */
function clearValidator() {
  document.getElementById('val-patente').value = '';
  document.getElementById('val-imei').value    = '';
  document.getElementById('result-panel').classList.remove('show');
  _valUnit      = null;
  _valGpsData   = null;
  // Limpiar mapa
  if (_valMap) {
    _valMapLayers.forEach(l => _valMap.removeLayer(l));
    _valMapLayers = [];
  }
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
    _initAdminFilters();
    if (_pendingDestFilter) {
      const sel = document.getElementById('admin-filter-dest');
      if (sel) sel.value = _pendingDestFilter;
      _pendingDestFilter = null;
      filterAdminTable();
    }
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red)">
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
  <td>${u.name || '<span style="color:var(--text3)">—</span>'}</td>
  <td><span style="font-size:12px;color:var(--text2)">${u.rut || '<span style="color:var(--text3)">—</span>'}</span></td>
  <td style="max-width:220px">${destBadges}</td>
  <td>${statusBadge}</td>
  <td>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="btn sm ${u.enabled ? 'danger' : 'success'}" title="${u.enabled ? 'Desactivar' : 'Activar'}"
        onclick="toggleUnit('${u.imei}', this)">
        ${u.enabled ? 'Desactivar' : 'Activar'}
      </button>
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

function _initAdminFilters() {
  const sel = document.getElementById('admin-filter-dest');
  if (!sel || !_adminUnits) return;
  const dests = new Set();
  _adminUnits.forEach(u => (u.destinations||[]).forEach(d => dests.add(d.name)));
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">Todos los destinos</option>' +
    '<option value="__sin_destino__">⚠ Sin destino asignado</option>' +
    [...dests].sort().map(d => `<option value="${d}">${d}</option>`).join('');
  if (cur) sel.value = cur;
}

function filterAdminTable() {
  if (!_adminUnits) return;
  const q      = (document.getElementById('admin-search')?.value       || '').toLowerCase().trim();
  const status = (document.getElementById('admin-filter-status')?.value || '');
  const dest   = (document.getElementById('admin-filter-dest')?.value   || '');
  const filtered = _adminUnits.filter(u => {
    if (q) {
      const hay = [u.plate, u.imei, u.name, u.rut].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (status === 'active'   && !u.enabled) return false;
    if (status === 'inactive' &&  u.enabled) return false;
    if (dest === '__sin_destino__') {
      if ((u.destinations || []).some(d => d.enabled)) return false;
    } else if (dest) {
      const names = (u.destinations || []).map(d => d.name.toLowerCase());
      if (!names.some(n => n.includes(dest.toLowerCase()))) return false;
    }
    return true;
  });
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
  const toggleBtn = document.getElementById('btn-toggle-selected');
  if (toggleBtn) toggleBtn.disabled = !anyChecked;
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
  if (document.getElementById('modal-cliente'))    document.getElementById('modal-cliente').value    = unit.name       || '';
  if (document.getElementById('modal-rut'))        document.getElementById('modal-rut').value        = unit.rut        || '';

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
  const imei    = _editingImei;
  const plate   = document.getElementById('modal-patente').value.trim().toUpperCase();
  const cliente    = document.getElementById('modal-cliente')?.value.trim()    || null;
  const rut        = document.getElementById('modal-rut')?.value.trim()        || null;
  const btn = document.getElementById('modal-save-btn');

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    await api.patch(`/units/${imei}`, { plate: plate || null, name: cliente, rut });
    showToast('Guardado', `Unidad ${imei} actualizada.`);
    closeModal();
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

    const cliente    = document.getElementById('modal-cliente')?.value.trim()    || null;
    const rut        = document.getElementById('modal-rut')?.value.trim()        || null;
    // 2. Crear unidad si no existe, o actualizar si ya existe
    if (!unitExists) {
      await api.post('/units', { imei, plate: plate || null, name: cliente, rut });
    } else {
      await api.patch(`/units/${imei}`, { plate: plate || null, name: cliente, rut });
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
          // Leer todas las columnas "Integración N" como array de destinos
          const destinos = [];
          if (r['destino'])      destinos.push(r['destino']);
          if (r['organización']) destinos.push(r['organización']);
          if (r['organizacion']) destinos.push(r['organizacion']);
          if (r['org'])          destinos.push(r['org']);
          let i = 1;
          while (true) {
            const d = r[`integración ${i}`] || r[`integracion ${i}`] || r[`integration ${i}`];
            if (!d) break;
            destinos.push(d);
            i++;
          }
          return {
            imei:     r['imei']    || '',
            plate:    r['patente'] || r['plate'] || r['placa'] || '',
            cliente:  r['cliente'] || r['nombre cliente'] || r['cliente_nombre'] || '',
            rut:      r['rut cliente'] || r['rut_cliente'] || r['rut'] || '',
            destinos: [...new Set(destinos.filter(Boolean))],
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

  try {
    // ── PASO 1: Upsert masivo de unidades en una sola llamada ──
    btn.textContent = `Enviando ${_importData.length} unidades…`;
    await api.post('/units/batch', {
      units: _importData.map(u => ({
        imei:  u.imei,
        plate: u.plate   || null,
        name:  u.cliente || null,
        rut:   u.rut     || null,
      }))
    });

    // ── PASO 2: Pre-crear todas las orgs necesarias (secuencial para evitar duplicados) ──
    const unitsWithDests = _importData.filter(u => u.destinos?.length);

    if (unitsWithDests.length) {
      btn.textContent = 'Preparando organizaciones…';

      // Mapa nombre → id con las orgs existentes
      const orgByName = {};
      Object.entries(ORGS).forEach(([id, org]) => {
        orgByName[org.name.toLowerCase().trim()] = id;
      });

      // Recolectar todos los nombres de destinos únicos del archivo
      const allDestNames = [...new Set(
        unitsWithDests.flatMap(u => u.destinos).map(d => d.trim()).filter(Boolean)
      )];

      // Crear secuencialmente las que no existen (evita duplicados por paralelismo)
      for (const destNombre of allDestNames) {
        const key = destNombre.toLowerCase().trim();
        if (orgByName[key]) continue; // ya existe, saltar

        try {
          const newId   = 'org-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          const newDest = await api.post('/destinations', {
            id:           newId,
            name:         destNombre,
            api_url:      null,
            color:        '#38bdf8',
            field_schema: [],
          });
          ORGS[newId] = destToOrg(newDest);
          orgByName[key] = newId;
        } catch (_) {}
      }

      // ── PASO 3: Asignar destinos en paralelo (orgs ya existen todas) ──
      const BATCH = 20;
      for (let i = 0; i < unitsWithDests.length; i += BATCH) {
        btn.textContent = `Asignando destinos ${i}/${unitsWithDests.length}…`;
        const batch = unitsWithDests.slice(i, i + BATCH);
        await Promise.allSettled(batch.map(async unit => {
          for (const destNombre of unit.destinos) {
            const destId = orgByName[destNombre.toLowerCase().trim()];
            if (!destId) continue;
            try {
              await api.post(`/units/${unit.imei}/destinations`, { destination_id: destId });
            } catch (e) {
              if (!e.message?.includes('ya tiene ese destino')) console.warn(e);
            }
          }
        }));
      }
    }

    showToast('Importación completa', `✓ ${_importData.length} unidades procesadas`);

  } catch (e) {
    showToast('Error', 'Falló la importación. Verifica la conexión.');
    console.error(e);
  } finally {
    _importData = [];
    document.getElementById('excel-file').value     = '';
    document.getElementById('excel-preview').value  = '';
    document.getElementById('btn-preview').disabled = true;
    document.getElementById('btn-import').disabled  = true;
    btn.disabled    = false;
    btn.textContent = 'Importar';
    renderAdminTable();
  }
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
    const headers = ['IMEI', 'Patente', 'Cliente', 'RUT', 'Destino'];

    const rows = units.map(u => [
      u.imei  || '',
      u.plate || '',
      u.name  || '',
      u.rut   || '',
      (u.destinations || []).map(d => d.name).join(' | '),
    ]);

    const csv = BOM + [headers, ...rows]
      .map((row, ri) => row.map((cell, ci) => {
        const val = String(cell).replace(/"/g, '""');
        // IMEI (col 0) y RUT (col 3): prefijo \t fuerza texto en Excel
        if (ri > 0 && (ci === 0 || ci === 3) && val) return '"\t' + val + '"';
        return '"' + val + '"';
      }).join(';'))
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
async function toggleUnit(imei, btn) {
  btn.disabled = true;
  try {
    const updated = await api.patch(`/units/${imei}/toggle`, {});
    const unit = _adminUnits.find(u => u.imei === imei);
    if (unit) unit.enabled = updated.enabled;

    // Badge está en td anterior al td de acciones
    const tr    = btn.closest('tr');
    const tds   = tr.querySelectorAll('td');
    const badge = tds[6].querySelector('.badge');
    if (badge) {
      badge.textContent = updated.enabled ? 'Activo' : 'Inactivo';
      badge.className   = updated.enabled ? 'badge green' : 'badge red';
    }
    btn.textContent = updated.enabled ? 'Desactivar' : 'Activar';
    btn.className   = `btn sm ${updated.enabled ? 'danger' : 'success'}`;
    showToast(updated.enabled ? 'Activado' : 'Desactivado', `Unidad ${imei} ${updated.enabled ? 'activada' : 'desactivada'}.`);
  } catch (_) {
  } finally {
    btn.disabled = false;
  }
}

async function toggleSelected() {
  const checked = [...document.querySelectorAll('.row-chk:checked')];
  if (!checked.length) return;

  const imeis = checked.map(el => el.dataset.imei);

  // Si la mayoría están activas → desactivar todo, si no → activar todo
  const activeCount = imeis.filter(imei => _adminUnits.find(u => u.imei === imei)?.enabled).length;
  const activate    = activeCount <= imeis.length / 2;
  const action      = activate ? 'Activar' : 'Desactivar';

  if (!confirm(`¿${action} ${imeis.length} unidad${imeis.length > 1 ? 'es' : ''}?`)) return;

  const btn = document.getElementById('btn-toggle-selected');
  btn.disabled    = true;
  btn.textContent = activate ? 'Activando…' : 'Desactivando…';

  let ok = 0, fail = 0;
  await Promise.allSettled(imeis.map(async imei => {
    try {
      const unit = _adminUnits.find(u => u.imei === imei);
      // Solo llamar toggle si el estado actual es diferente al deseado
      if (!unit || unit.enabled === activate) {
        ok++; return; // ya tiene el estado correcto
      }
      const updated = await api.patch('/units/' + imei + '/toggle', {});
      if (unit) unit.enabled = updated.enabled;
      ok++;
    } catch (_) { fail++; }
  }));

  const verb = activate ? 'activada' : 'desactivada';
  const msg  = fail
    ? `${ok} ${verb}${ok !== 1 ? 's' : ''}, ${fail} fallaron`
    : `${ok} unidad${ok !== 1 ? 'es' : ''} ${verb}${ok !== 1 ? 's' : ''}`;
  showToast(activate ? '✅ Activadas' : '🚫 Desactivadas', msg);

  _paintAdminTable(_adminUnits);
  filterAdminTable();
}

async function deleteSelected() {
  const checked = [...document.querySelectorAll('.row-chk:checked')];
  if (!checked.length) return;

  const imeis = checked.map(el => el.dataset.imei);
  if (!confirm(`¿Eliminar ${imeis.length} unidad${imeis.length > 1 ? 'es' : ''}? Esta acción no se puede deshacer.`)) return;

  const btn = document.getElementById('btn-delete-selected');
  btn.disabled    = true;
  btn.textContent = 'Eliminando…';

  try {
    await api.delete('/units/batch', { imeis });
    showToast('Eliminado', `✓ ${imeis.length} unidad${imeis.length !== 1 ? 'es' : ''} eliminada${imeis.length !== 1 ? 's' : ''}`);
  } catch (_) {
    showToast('Error', 'No se pudieron eliminar las unidades.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Eliminar';
    renderAdminTable();
  }
}
/* ══════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════
   HISTORIAL DE CAMBIOS
══════════════════════════════════════════════════════════ */

// Etiquetas legibles para las acciones
const _AUDIT_LABELS = {
  UNIT_CREATE:       { icon: '➕', label: 'Unidad creada',       color: 'var(--green)' },
  UNIT_UPDATE:       { icon: '✏️',  label: 'Unidad editada',      color: 'var(--sky)'   },
  UNIT_ENABLE:       { icon: '✅', label: 'Unidad activada',     color: 'var(--green)' },
  UNIT_DISABLE:      { icon: '🚫', label: 'Unidad desactivada',  color: 'var(--amber)' },
  UNIT_DELETE:       { icon: '🗑', label: 'Unidad eliminada',    color: 'var(--red)'   },
  UNIT_BATCH_UPSERT: { icon: '📦', label: 'Carga masiva',        color: 'var(--sky)'   },
  UNIT_BATCH_DELETE: { icon: '🗑', label: 'Eliminación masiva',  color: 'var(--red)'   },
  UNIT_DEST_ADD:     { icon: '🔗', label: 'Destino asignado',    color: 'var(--sky)'   },
  UNIT_DEST_REMOVE:  { icon: '✂️',  label: 'Destino removido',    color: 'var(--amber)' },
  DEST_CREATE:       { icon: '➕', label: 'Destino creado',      color: 'var(--green)' },
  DEST_UPDATE:       { icon: '✏️',  label: 'Destino editado',     color: 'var(--sky)'   },
  DEST_DELETE:       { icon: '🗑', label: 'Destino eliminado',   color: 'var(--red)'   },
};

function _auditLabel(action) {
  const e = _AUDIT_LABELS[action];
  return e ? `<span style="color:${e.color}">${e.icon} ${e.label}</span>`
           : `<span style="color:var(--text2)">${action}</span>`;
}

function _auditDiff(before, after) {
  if (!before && !after) return '';
  if (!before) return '<span style="color:var(--green);font-size:11px">Nuevo registro</span>';
  if (!after)  return '<span style="color:var(--red);font-size:11px">Eliminado</span>';
  // Mostrar campos que cambiaron
  const changes = [];
  const allKeys = new Set([...Object.keys(before||{}), ...Object.keys(after||{})]);
  allKeys.forEach(k => {
    if (k === 'updated_at' || k === 'created_at') return;
    const vb = JSON.stringify(before[k] ?? null);
    const va = JSON.stringify(after[k]  ?? null);
    if (vb !== va) {
      changes.push(`<span style="color:var(--text3)">${k}:</span> ` +
        `<span style="color:var(--red);text-decoration:line-through">${vb}</span> ` +
        `<span style="color:var(--green)">→ ${va}</span>`);
    }
  });
  return changes.length
    ? changes.map(c => `<div style="font-size:11px;margin-top:2px">${c}</div>`).join('')
    : '<span style="font-size:11px;color:var(--text3)">Sin cambios detectados</span>';
}

let _auditPage  = 0;
let _auditTotal = 0;
const _AUDIT_LIMIT = 50;

async function openHistorial() {
  // Crear modal si no existe
  let modal = document.getElementById('historial-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'historial-modal';
    modal.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;
      align-items:center;justify-content:center;
      background:rgba(0,0,0,.6);backdrop-filter:blur(4px);`;
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  _auditPage = 0;
  _renderHistorialModal(modal);
}

function closeHistorial() {
  const m = document.getElementById('historial-modal');
  if (m) m.style.display = 'none';
}

async function _renderHistorialModal(modal) {
  // Skeleton
  modal.innerHTML = `
    <div style="background:var(--bg1);border:1px solid var(--border);border-radius:12px;
      width:min(900px,96vw);max-height:88vh;display:flex;flex-direction:column;
      box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="padding:18px 20px;border-bottom:1px solid var(--border);
        display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">📋</span>
          <div>
            <div style="font-weight:700;font-size:15px">Historial de cambios</div>
            <div id="hist-subtitle" style="font-size:12px;color:var(--text3)">Cargando…</div>
          </div>
        </div>
        <button onclick="closeHistorial()" style="width:30px;height:30px;border-radius:6px;
          border:1px solid var(--border);background:transparent;cursor:pointer;
          color:var(--text2);font-size:18px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>

      <!-- Filtros -->
      <div style="padding:12px 20px;border-bottom:1px solid var(--border);
        display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="hist-search" class="input" placeholder="Buscar acción, usuario, objeto…"
          oninput="_auditBuscar()" style="flex:1;min-width:200px;font-size:13px;height:34px"/>
        <select id="hist-action" class="input" onchange="_auditBuscar()"
          style="font-size:13px;height:34px;min-width:160px;cursor:pointer">
          <option value="">Todas las acciones</option>
          <option value="UNIT">Unidades</option>
          <option value="DEST">Destinos</option>
          <option value="CLIENTE">Clientes</option>
          <option value="USER">Usuarios</option>
        </select>
        <select id="hist-user" class="input" onchange="_auditBuscar()"
          style="font-size:13px;height:34px;min-width:130px;cursor:pointer">
          <option value="">Todos los usuarios</option>
        </select>
        <button onclick="_auditLimpiar()" class="btn sm" style="height:34px">Limpiar</button>
      </div>

      <!-- Tabla -->
      <div style="overflow-y:auto;flex:1" id="hist-body">
        <div style="text-align:center;padding:40px;color:var(--text3)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:8px">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>Cargando historial…
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:12px 20px;border-top:1px solid var(--border);
        display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span id="hist-count" style="font-size:12px;color:var(--text3)"></span>
        <div style="display:flex;gap:6px">
          <button id="hist-prev" class="btn sm" disabled onclick="_auditPrev()">← Anterior</button>
          <button id="hist-next" class="btn sm" disabled onclick="_auditNext()">Siguiente →</button>
          <button onclick="closeHistorial()" class="btn sm">Cerrar</button>
        </div>
      </div>
    </div>`;

  await _cargarAudit();
}

let _auditLastSearch = '';
let _auditDebounce = null;

function _auditBuscar() {
  clearTimeout(_auditDebounce);
  _auditDebounce = setTimeout(async () => {
    _auditPage = 0;
    await _cargarAudit();
  }, 300);
}

function _auditLimpiar() {
  document.getElementById('hist-search').value  = '';
  document.getElementById('hist-action').value  = '';
  document.getElementById('hist-user').value    = '';
  _auditPage = 0;
  _cargarAudit();
}

function _auditPrev() { if (_auditPage > 0) { _auditPage--; _cargarAudit(); } }
function _auditNext() {
  if ((_auditPage + 1) * _AUDIT_LIMIT < _auditTotal) { _auditPage++; _cargarAudit(); }
}

async function _cargarAudit() {
  const body   = document.getElementById('hist-body');
  const search = document.getElementById('hist-search')?.value.trim() || '';
  const action = document.getElementById('hist-action')?.value || '';
  const user   = document.getElementById('hist-user')?.value   || '';

  const params = new URLSearchParams({
    limit:  _AUDIT_LIMIT,
    offset: _auditPage * _AUDIT_LIMIT,
  });
  if (search) params.set('search', search);
  if (action) params.set('action', action);
  if (user)   params.set('username', user);

  try {
    const data = await api.get('/admin/audit?' + params.toString());
    _auditTotal = data.total || 0;

    // Actualizar subtítulo
    const sub = document.getElementById('hist-subtitle');
    if (sub) sub.textContent = `${_auditTotal} evento${_auditTotal !== 1 ? 's' : ''} registrado${_auditTotal !== 1 ? 's' : ''}`;

    // Actualizar contador
    const cnt = document.getElementById('hist-count');
    const from = _auditPage * _AUDIT_LIMIT + 1;
    const to   = Math.min(from + _AUDIT_LIMIT - 1, _auditTotal);
    if (cnt) cnt.textContent = _auditTotal ? `Mostrando ${from}–${to} de ${_auditTotal}` : 'Sin resultados';

    // Paginación
    const prev = document.getElementById('hist-prev');
    const next = document.getElementById('hist-next');
    if (prev) prev.disabled = _auditPage === 0;
    if (next) next.disabled = to >= _auditTotal;

    // Poblar selector de usuarios únicos (solo primera carga)
    if (_auditPage === 0 && !search && !action && !user) {
      const sel = document.getElementById('hist-user');
      if (sel && sel.options.length === 1) {
        const users = [...new Set(data.rows.map(r => r.username).filter(Boolean))].sort();
        users.forEach(u => {
          const o = document.createElement('option');
          o.value = u; o.textContent = u;
          sel.appendChild(o);
        });
      }
    }

    if (!data.rows.length) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3)">
        <div style="font-size:32px;margin-bottom:8px">📭</div>
        Sin eventos registrados para este filtro</div>`;
      return;
    }

    body.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--bg2);font-size:11px;text-transform:uppercase;
            letter-spacing:.5px;color:var(--text3);position:sticky;top:0">
            <th style="padding:8px 12px;text-align:left">Fecha</th>
            <th style="padding:8px 12px;text-align:left">Usuario</th>
            <th style="padding:8px 12px;text-align:left">Acción</th>
            <th style="padding:8px 12px;text-align:left">Objeto</th>
            <th style="padding:8px 12px;text-align:left">Cambios</th>
          </tr>
        </thead>
        <tbody>
          ${data.rows.map(r => `
            <tr style="border-bottom:1px solid var(--border);vertical-align:top"
              onmouseenter="this.style.background='var(--bg2)'"
              onmouseleave="this.style.background=''">
              <td style="padding:8px 12px;white-space:nowrap;font-size:12px;color:var(--text2)">
                ${new Date(r.created_at).toLocaleString('es-CL')}
              </td>
              <td style="padding:8px 12px;font-size:12px">
                <div style="font-weight:600">${r.username || '—'}</div>
                ${r.role ? `<div style="color:var(--text3);font-size:11px">${r.role}</div>` : ''}
              </td>
              <td style="padding:8px 12px">${_auditLabel(r.action)}</td>
              <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:var(--text2)">
                ${r.target || '—'}
              </td>
              <td style="padding:8px 12px;max-width:300px">
                ${_auditDiff(r.before_data, r.after_data)}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    if (body) body.innerHTML = `<div style="color:var(--red);padding:20px">
      Error al cargar historial: ${e.message}</div>`;
  }
}

function _abrirModalSinDestino(units) {
  let modal = document.getElementById('modal-sin-destino');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-sin-destino';
    modal.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;
      align-items:center;justify-content:center;
      background:rgba(0,0,0,.6);backdrop-filter:blur(4px);`;
    document.body.appendChild(modal);
  }
  modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
  const rows = units.map(u => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-weight:600;font-family:monospace">${u.plate||'—'}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--text2);font-family:monospace">${u.imei}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--text2)">${u.name||'—'}</td>
      <td style="padding:8px 12px">
        <button onclick="_irAPatenteBuscar('${u.plate||u.imei}')" class="btn sm primary">Ver en patentes</button>
      </td>
    </tr>`).join('');
  modal.innerHTML = `
    <div style="background:var(--bg1);border:1px solid var(--border);border-radius:12px;
      width:min(700px,92vw);max-height:80vh;display:flex;flex-direction:column;
      box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">⚠️</span>
          <div>
            <div style="font-weight:700;font-size:15px">Unidades sin destino</div>
            <div style="font-size:12px;color:var(--text3)">${units.length} unidad${units.length!==1?'es':''} requieren configuración</div>
          </div>
        </div>
        <button onclick="document.getElementById('modal-sin-destino').style.display='none'"
          style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);
            background:transparent;cursor:pointer;color:var(--text2);font-size:16px;line-height:1">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg2);font-size:11px;text-transform:uppercase;
            letter-spacing:.5px;color:var(--text3)">
            <th style="padding:8px 12px;text-align:left;font-weight:600">Patente</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600">IMEI</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600">Nombre</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600">Acción</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);
        display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--text3)">Asigna destinos desde Configuración → Organizaciones</span>
        <div style="display:flex;gap:8px">
          <button onclick="_irAPatentesConFiltro();document.getElementById('modal-sin-destino').style.display='none'"
            class="btn sm primary">Ver todas en Patentes / IMEI</button>
          <button onclick="document.getElementById('modal-sin-destino').style.display='none'"
            class="btn sm">Cerrar</button>
        </div>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

function _irAPatenteBuscar(plate) {
  // Cerrar el modal si existe (puede no estar en el DOM si ya se cerró)
  const modal = document.getElementById('modal-sin-destino');
  if (modal) modal.style.display = 'none';
  // Cerrar también cualquier overlay genérico
  document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  navigate('patentes');
  setTimeout(() => {
    const inp = document.getElementById('admin-search');
    if (inp) {
      inp.value = plate;
      inp.dispatchEvent(new Event('input'));  // disparar filtro
      filterAdminTable();
    }
  }, 400);
}

let _pendingDestFilter = null;

function _irAPatentesConFiltro() {
  _pendingDestFilter = '__sin_destino__';
  navigate('patentes');
}

async function loadDashboard() {
  // Resetear KPIs a estado cargando
  ['kpi-units','kpi-active','kpi-queries','kpi-errors'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '…';
  });

  try {
    const units = await api.get('/units');

    // ── KPI: Unidades activas ──
    const activeUnits = units.filter(u => u.enabled);
    document.getElementById('kpi-units').textContent = activeUnits.length;

    // ── KPI: Integraciones activas (destinos habilitados en total) ──
    const totalDests = units.reduce((sum, u) => {
      const dests = u.destinations || [];
      return sum + dests.filter(d => d.enabled).length;
    }, 0);
    document.getElementById('kpi-active').textContent = totalDests;

    // ── KPI: Sin destinos (solo admin) ──
    const sinDestinos = activeUnits.filter(u => !(u.destinations?.some(d => d.enabled)));
    const adminCard = document.getElementById('kpi-admin-card');
    if (state?.user?.role === 'admin') {
      if (adminCard) {
        adminCard.style.display = '';
        adminCard.style.cursor  = 'pointer';
        adminCard.title         = 'Ver unidades sin destino';
        adminCard.onclick       = () => _abrirModalSinDestino(sinDestinos);
      }
      document.getElementById('kpi-errors').textContent = sinDestinos.length;
    }

    // ── KPI: Consultas hoy — no hay endpoint, mostramos unidades con destinos ──
    document.getElementById('kpi-queries').textContent = activeUnits.length - sinDestinos.length;

    // ── Estado del sistema ──
    const integBadge = document.getElementById('status-integrations');
    if (integBadge) {
      integBadge.textContent = totalDests > 0 ? `${totalDests} activas` : 'Sin configurar';
      integBadge.className   = `badge ${totalDests > 0 ? 'green' : 'amber'}`;
    }
    const syncEl = document.getElementById('status-sync');
    if (syncEl) syncEl.textContent = new Date().toLocaleTimeString('es-CL');

    // ── Actividad reciente ──
    _renderDashboardActivity(units);

  } catch (e) {
    console.error('[dashboard]', e);
    document.getElementById('kpi-units').textContent   = '!';
    document.getElementById('kpi-active').textContent  = '!';
    document.getElementById('kpi-queries').textContent = '!';
  }
}

function _renderDashboardActivity(units) {
  const container = document.querySelector('#view-dashboard .activity-item')?.parentElement;
  if (!container) return;

  const activeUnits   = units.filter(u => u.enabled);
  const sinDest       = activeUnits.filter(u => !(u.destinations?.some(d => d.enabled)));
  const conDest       = activeUnits.filter(u => u.destinations?.some(d => d.enabled));
  const totalDests    = units.reduce((s, u) => s + (u.destinations?.filter(d => d.enabled).length || 0), 0);

  const items = [];

  if (activeUnits.length > 0) {
    items.push({ color: 'var(--green)', text: `${activeUnits.length} unidad${activeUnits.length !== 1 ? 'es' : ''} activa${activeUnits.length !== 1 ? 's' : ''} registrada${activeUnits.length !== 1 ? 's' : ''}`, sub: 'En el sistema' });
  }
  if (totalDests > 0) {
    items.push({ color: 'var(--sky)', text: `${totalDests} integración${totalDests !== 1 ? 'es' : ''} configurada${totalDests !== 1 ? 's' : ''}`, sub: 'Destinos activos' });
  }
  if (sinDest.length > 0) {
    items.push({
      color: 'var(--amber)',
      text: `${sinDest.length} unidad${sinDest.length !== 1 ? 'es' : ''} sin destino asignado`,
      sub: 'Requieren configuración — clic para ver',
      onclick: () => _abrirModalSinDestino(sinDest)
    });
  }
  if (conDest.length > 0) {
    items.push({ color: 'var(--green)', text: `${conDest.length} unidad${conDest.length !== 1 ? 'es' : ''} con integración activa`, sub: 'Enviando a destinos' });
  }
  if (items.length === 0) {
    items.push({ color: 'var(--text3)', text: 'Sin unidades registradas aún', sub: 'Agrega unidades en Patentes / IMEI' });
  }

    container.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'activity-item';
    if (item.onclick) {
      div.style.cursor = 'pointer';
      div.addEventListener('mouseenter', () => div.style.opacity = '.7');
      div.addEventListener('mouseleave', () => div.style.opacity = '1');
      div.addEventListener('click', item.onclick);
    }
    div.innerHTML = `
      <div class="activity-dot" style="background:${item.color}"></div>
      <div><p>${item.text}</p><small>${item.sub}</small></div>`;
    container.appendChild(div);
  });
}

/* ══════════════════════════════════════════════════════════════
   MODAL PERFIL
══════════════════════════════════════════════════════════════ */

function openPerfilModal() {
  // Prellenar con nombre visible actual (no el username de login)
  const displayName = localStorage.getItem('sigeulo_display_name') || state.user?.username || '';
  document.getElementById('perfil-username').value        = displayName;
  document.getElementById('perfil-current-pass').value    = '';
  document.getElementById('perfil-new-pass').value        = '';
  document.getElementById('perfil-error').style.display   = 'none';
  document.getElementById('perfil-save-btn').disabled     = false;
  document.getElementById('perfil-save-btn').textContent  = 'Guardar cambios';
  _renderPerfilAvatar();
  document.getElementById('perfil-modal').classList.add('show');
}

function closePerfilModal() {
  document.getElementById('perfil-modal').classList.remove('show');
}

// ── Logo storage via IndexedDB (soporta archivos grandes sin data URLs) ──
const _logoDB = (() => {
  let _db;
  const open = () => new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open('sigeulo_prefs', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess  = e => { _db = e.target.result; res(_db); };
    req.onerror    = () => rej(req.error);
  });
  return {
    set: async (key, val) => {
      const d = await open();
      return new Promise((res, rej) => {
        const tx = d.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    },
    get: async (key) => {
      const d = await open();
      return new Promise((res, rej) => {
        const req = d.transaction('kv', 'readonly').objectStore('kv').get(key);
        req.onsuccess = () => res(req.result ?? null);
        req.onerror   = () => rej(req.error);
      });
    },
  };
})();

function _renderPerfilAvatar() {
  const preview = document.getElementById('perfil-avatar-preview');
  if (!preview) return;
  _logoDB.get('logo').then(blob => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onload="try{URL.revokeObjectURL(this.src)}catch(e){}">`;
    } else {
      const name = state.user?.username || '?';
      preview.textContent = name.charAt(0).toUpperCase();
    }
  });
}

function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    showToast('Imagen muy grande', 'Usa una imagen menor a 1 MB.');
    return;
  }
  _logoDB.set('logo', file).then(() => {
    _renderPerfilAvatar();
    _applySidebarLogo();
    showToast('Logo actualizado', 'El logo del sidebar ha cambiado.');
  }).catch(() => showToast('Error', 'No se pudo guardar el logo.'));
}

function _applySidebarLogo() {
  const sidebarIcon = document.querySelector('.sidebar-logo .logo-icon');
  if (!sidebarIcon) return;
  _logoDB.get('logo').then(blob => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      sidebarIcon.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onload="try{URL.revokeObjectURL(this.src)}catch(e){}">`;
    } else {
      sidebarIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`;
    }
  });
}

async function savePerfil() {
  const displayName = document.getElementById('perfil-username').value.trim();
  const currentPass = document.getElementById('perfil-current-pass').value;
  const newPass     = document.getElementById('perfil-new-pass').value;
  const errEl       = document.getElementById('perfil-error');
  const btn         = document.getElementById('perfil-save-btn');

  errEl.style.display = 'none';

  // Validar nombre visible
  if (displayName.length < 2) {
    errEl.textContent   = 'El nombre debe tener al menos 2 caracteres.';
    errEl.style.display = '';
    return;
  }
  if (newPass && !currentPass) {
    errEl.textContent   = 'Ingresa tu contraseña actual para poder cambiarla.';
    errEl.style.display = '';
    return;
  }
  if (newPass && newPass.length < 6) {
    errEl.textContent   = 'La nueva contraseña debe tener al menos 6 caracteres.';
    errEl.style.display = '';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    // ── Nombre para mostrar: solo localStorage, no toca credenciales ──
    localStorage.setItem('sigeulo_display_name', displayName);
    _applyDisplayName(displayName);

    // ── Cambio de contraseña: llama al backend si se llenaron los campos ──
    if (newPass) {
      await api.patch('/auth/me', {
        username:        state.user?.username,
        currentPassword: currentPass,
        newPassword:     newPass,
      });
    }

    closePerfilModal();
    showToast('Perfil actualizado', 'Cambios guardados correctamente.');

  } catch (e) {
    const msg = e.message;
    if (msg && msg !== 'Forbidden' && msg !== 'Unauthorized') {
      errEl.textContent   = msg;
      errEl.style.display = '';
    }
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar cambios';
  }
}

function _applyDisplayName(name) {
  if (!name) name = localStorage.getItem('sigeulo_display_name') || state.user?.username || '';
  if (!name) return;
  document.getElementById('sidebar-username').textContent = name;
  const wl = document.getElementById('welcome-msg');
  if (wl) wl.textContent = `Bienvenido, ${name}`;
  _logoDB.get('logo').then(blob => {
    if (!blob) {
      const av = document.getElementById('sidebar-avatar');
      if (av) av.textContent = name.charAt(0).toUpperCase();
    }
  });
}

// Logo aplicado desde auth.js via _applySidebarLogo()

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN GENERAL
   ══════════════════════════════════════════════════════════════ */

const _ACCENT_COLORS = [
  { name: 'Índigo',    val: '#6366f1', grad: '#6366f1,#818cf8' },
  { name: 'Azul',      val: '#3b82f6', grad: '#3b82f6,#60a5fa' },
  { name: 'Cyan',      val: '#06b6d4', grad: '#06b6d4,#22d3ee' },
  { name: 'Esmeralda', val: '#10b981', grad: '#10b981,#34d399' },
  { name: 'Violeta',   val: '#8b5cf6', grad: '#8b5cf6,#a78bfa' },
  { name: 'Rosa',      val: '#ec4899', grad: '#ec4899,#f472b6' },
  { name: 'Naranja',   val: '#f59e0b', grad: '#f59e0b,#fbbf24' },
  { name: 'Rojo',      val: '#ef4444', grad: '#ef4444,#f87171' },
];

function initGeneralTab() {
  // Prellenar nombre/subtítulo
  const savedName     = localStorage.getItem('cfg_platform_name')     || 'Síguelo';
  const savedSubtitle = localStorage.getItem('cfg_platform_subtitle') || 'Integraciones';
  const savedExpiry   = localStorage.getItem('cfg_jwt_expiry')        || '8h';
  const savedAccent   = localStorage.getItem('cfg_accent_color')      || '#6366f1';
  const savedDensity  = localStorage.getItem('cfg_density')           || 'normal';

  document.getElementById('cfg-platform-name').value     = savedName;
  document.getElementById('cfg-platform-subtitle').value = savedSubtitle;
  document.getElementById('cfg-jwt-expiry').value        = savedExpiry;

  // Renderizar swatches de color
  const container = document.getElementById('accent-swatches');
  if (container) {
    container.innerHTML = _ACCENT_COLORS.map(c => `
      <button onclick="setAccentColor('${c.val}')" title="${c.name}"
        style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,${c.grad});
        cursor:pointer;border:3px solid ${savedAccent === c.val ? '#fff' : 'transparent'};
        transition:all .2s;box-shadow:${savedAccent === c.val ? '0 0 0 2px ' + c.val : 'none'}"
        id="swatch-${c.val.slice(1)}">
      </button>
    `).join('');
  }

  // Marcar densidad activa
  _applyDensityUI(savedDensity);
  _applyAccentColor(savedAccent);
}

function setAccentColor(hex) {
  localStorage.setItem('cfg_accent_color', hex);
  _applyAccentColor(hex);
  // Actualizar borde de swatches
  document.querySelectorAll('#accent-swatches button').forEach(btn => {
    const isActive = btn.title === _ACCENT_COLORS.find(c => c.val === hex)?.name;
    btn.style.border = isActive ? '3px solid #fff' : '3px solid transparent';
    btn.style.boxShadow = isActive ? `0 0 0 2px ${hex}` : 'none';
  });
  showToast('Color actualizado', 'El color de acento se aplicó.', 'success');
}

function _applyAccentColor(hex) {
  // Inyectar variable CSS --sky con el color elegido
  let style = document.getElementById('cfg-accent-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'cfg-accent-style';
    document.head.appendChild(style);
  }
  // Calcular versión más oscura para hover
  style.textContent = `:root { --sky: ${hex}; --indigo: ${hex}cc; }`;
}

function setDensity(density) {
  localStorage.setItem('cfg_density', density);
  _applyDensityUI(density);
  _applyDensityCSS(density);
  showToast('Densidad actualizada', 'La interfaz se ajustó.', 'success');
}

function _applyDensityUI(density) {
  document.querySelectorAll('.density-btn').forEach(btn => {
    const active = btn.dataset.density === density;
    btn.style.background   = active ? 'rgba(99,102,241,.2)' : 'transparent';
    btn.style.color        = active ? '#a5b4fc' : 'var(--text2)';
    btn.style.borderColor  = active ? 'rgba(99,102,241,.4)' : 'var(--border)';
    btn.style.fontWeight   = active ? '600' : '400';
  });
}

function _applyDensityCSS(density) {
  let style = document.getElementById('cfg-density-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'cfg-density-style';
    document.head.appendChild(style);
  }
  const map = {
    compact: `:root { --row-pad: 6px 12px; --card-pad: 12px; } .card-body { padding: 12px; } td, th { padding: 6px 12px !important; }`,
    normal:  `:root { --row-pad: 10px 16px; --card-pad: 16px; }`,
    relaxed: `:root { --row-pad: 14px 20px; --card-pad: 20px; } .card-body { padding: 20px; } td, th { padding: 14px 20px !important; }`,
  };
  style.textContent = map[density] || '';
}

function savePlatformConfig() {
  const name     = document.getElementById('cfg-platform-name').value.trim()     || 'Síguelo';
  const subtitle = document.getElementById('cfg-platform-subtitle').value.trim() || 'Integraciones';
  localStorage.setItem('cfg_platform_name',     name);
  localStorage.setItem('cfg_platform_subtitle', subtitle);
  _applyPlatformName(name, subtitle);
  showToast('Guardado', 'Nombre de la plataforma actualizado.');
}

function _applyPlatformName(name, subtitle) {
  if (!name) {
    name     = localStorage.getItem('cfg_platform_name')     || 'Síguelo';
    subtitle = localStorage.getItem('cfg_platform_subtitle') || 'Integraciones';
  }
  // Sidebar brand
  const brandName = document.querySelector('.sidebar-logo .logo-name');
  const brandSub  = document.querySelector('.sidebar-logo .logo-sub');
  if (brandName) brandName.textContent = name;
  if (brandSub)  brandSub.textContent  = subtitle;
  // Título del navegador
  document.title = `${name} | ${subtitle}`;
}

function saveSessionConfig() {
  const expiry = document.getElementById('cfg-jwt-expiry').value;
  localStorage.setItem('cfg_jwt_expiry', expiry);
  showToast('Guardado', `Expiración de sesión configurada a ${expiry}. Aplica en nuevos logins.`);
}

async function loadSystemInfo() {
  const grid = document.getElementById('sysinfo-grid');
  const btn  = document.getElementById('sysinfo-refresh-btn');
  if (!grid) return;

  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text3);font-size:13px">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:6px">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>Cargando...</div>`;
  if (btn) btn.disabled = true;

  try {
    const info = await api.get('/admin/system-info');

    const uptime = _formatUptime(info.uptime || 0);
    const ts     = new Date(info.ts).toLocaleString('es-CL');

    const _stat = (label, value, sub, color) => `
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);border-right:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${label}</div>
        <div style="font-size:18px;font-weight:700;color:${color || 'var(--text1)'}">${value}</div>
        ${sub ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${sub}</div>` : ''}
      </div>`;

    grid.innerHTML = `
      ${_stat('Estado DB', info.db === 'connected' ? '● Conectada' : '● Error', info.env, info.db === 'connected' ? '#86efac' : '#fca5a5')}
      ${_stat('Uptime',    uptime, 'desde último reinicio', 'var(--text1)')}
      ${_stat('Node.js',   info.node || '—', 'versión del servidor', 'var(--text2)')}
      ${_stat('Versión',   'v' + (info.version || '1.0.0'), ts, 'var(--text2)')}
      ${_stat('Unidades',  info.counts?.units || '0', 'registradas en DB', '#a5b4fc')}
      ${_stat('Usuarios',  info.counts?.users || '0', 'cuentas activas', '#a5b4fc')}
      ${_stat('Clientes',  info.counts?.clientes || '0', 'clientes registrados', '#a5b4fc')}
      <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Entorno</div>
        <div style="font-size:14px;font-weight:600;color:var(--text2)">${info.env || 'production'}</div>
      </div>
    `;
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:#fca5a5;font-size:13px">
      No se pudo conectar con el servidor.</div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function _formatUptime(seconds) {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ${seconds%60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h/24)}d ${h%24}h`;
}

// Aplicar configuración guardada al iniciar sesión
function _applyAllSavedConfig() {
  const accent  = localStorage.getItem('cfg_accent_color');
  const density = localStorage.getItem('cfg_density');
  const name    = localStorage.getItem('cfg_platform_name');
  const sub     = localStorage.getItem('cfg_platform_subtitle');
  if (accent)  _applyAccentColor(accent);
  if (density) _applyDensityCSS(density);
  if (name)    _applyPlatformName(name, sub);
}

/* ══════════════════════════════════════════════════════════════
   GESTIÓN DE USUARIOS (solo admin)
   ══════════════════════════════════════════════════════════════ */

let _usersCache = [];

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:24px">Cargando...</td></tr>`;
  try {
    const rows = await api.get('/auth/users');
    _usersCache = rows;
    _renderUsersTable(rows);
  } catch (e) {
    console.error('loadUsers:', e);
  }
}

function _userRoleBadge(role) {
  return role === 'admin'
    ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(99,102,241,.18);color:#a5b4fc;border:1px solid rgba(99,102,241,.3)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        Admin
       </span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(20,184,166,.12);color:#5eead4;border:1px solid rgba(20,184,166,.25)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Operador
       </span>`;
}

function _userStatusBadge(enabled) {
  return enabled
    ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.25)">
        <span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span>Activo
       </span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(239,68,68,.1);color:#fca5a5;border:1px solid rgba(239,68,68,.2)">
        <span style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block"></span>Inactivo
       </span>`;
}

function _userAvatar(username) {
  const colors = ['135,var(--sky),var(--indigo)','135,#f59e0b,#ef4444','135,#10b981,#3b82f6','135,#8b5cf6,#ec4899'];
  const idx = username.charCodeAt(0) % colors.length;
  return `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(${colors[idx]});
    display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;text-transform:uppercase">
    ${username.charAt(0)}</div>`;
}

function _renderUsersTable(rows) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:32px">Sin usuarios registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(u => `
    <tr style="transition:background .15s" onmouseenter="this.style.background='rgba(255,255,255,.03)'" onmouseleave="this.style.background=''">
      <td style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:10px">
          ${_userAvatar(u.username)}
          <div>
            <div style="font-weight:500;font-size:13px">${u.username}</div>
            <div style="font-size:11px;color:var(--text3)">ID #${u.id}</div>
          </div>
        </div>
      </td>
      <td style="padding:12px 16px">${_userRoleBadge(u.role)}</td>
      <td style="padding:12px 16px">${_userStatusBadge(u.enabled)}</td>
      <td style="padding:12px 16px">
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="openUserForm('${u.id}')" title="Editar usuario"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:6px;
            font-size:12px;font-weight:500;cursor:pointer;border:1px solid rgba(255,255,255,.1);
            background:rgba(255,255,255,.05);color:var(--text2);transition:all .15s"
            onmouseenter="this.style.background='rgba(99,102,241,.2)';this.style.color='#a5b4fc';this.style.borderColor='rgba(99,102,241,.4)'"
            onmouseleave="this.style.background='rgba(255,255,255,.05)';this.style.color='var(--text2)';this.style.borderColor='rgba(255,255,255,.1)'">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>
          <button onclick="toggleUserEnabled('${u.id}', ${u.enabled})" title="${u.enabled ? 'Desactivar' : 'Activar'}"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:6px;
            font-size:12px;font-weight:500;cursor:pointer;border:1px solid ${u.enabled ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.25)'};
            background:${u.enabled ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.08)'};
            color:${u.enabled ? '#fca5a5' : '#86efac'};transition:all .15s"
            onmouseenter="this.style.opacity='.8'"
            onmouseleave="this.style.opacity='1'">
            ${u.enabled
              ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Desactivar`
              : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Activar`
            }
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openUserForm(userId) {
  const form  = document.getElementById('user-form-inline');
  const errEl = document.getElementById('uf-error');
  if (!form) return;
  errEl.style.display = 'none';

  if (userId) {
    // Modo edición — comparar como string para evitar tipo mismatch
    const u = _usersCache.find(x => String(x.id) === String(userId));
    if (!u) return;
    document.getElementById('uf-username').value  = u.username;
    document.getElementById('uf-role').value       = u.role;
    document.getElementById('uf-password').value   = '';
    document.getElementById('uf-password2').value  = '';
    document.getElementById('uf-editing').value    = String(userId);
    document.getElementById('uf-pass-label').textContent = 'Nueva contraseña (dejar en blanco para no cambiar)';
    document.getElementById('uf-save-btn').textContent   = 'Guardar cambios';
  } else {
    document.getElementById('uf-username').value  = '';
    document.getElementById('uf-role').value       = 'user';
    document.getElementById('uf-password').value   = '';
    document.getElementById('uf-password2').value  = '';
    document.getElementById('uf-editing').value    = '';
    document.getElementById('uf-pass-label').textContent = 'Contraseña';
    document.getElementById('uf-save-btn').textContent   = 'Crear usuario';
  }

  form.style.display = '';
  setTimeout(() => document.getElementById('uf-username')?.focus(), 50);
}

function closeUserForm() {
  document.getElementById('user-form-inline').style.display = 'none';
  document.getElementById('uf-error').style.display = 'none';
}

async function saveUser() {
  const editingId = document.getElementById('uf-editing').value;
  const username  = document.getElementById('uf-username').value.trim();
  const role      = document.getElementById('uf-role').value;
  const password  = document.getElementById('uf-password').value;
  const password2 = document.getElementById('uf-password2').value;
  const errEl     = document.getElementById('uf-error');
  const btn       = document.getElementById('uf-save-btn');

  errEl.style.display = 'none';

  if (username.length < 3) {
    errEl.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.';
    errEl.style.display = '';
    return;
  }
  if (!editingId && !password) {
    errEl.textContent = 'La contraseña es obligatoria para nuevos usuarios.';
    errEl.style.display = '';
    return;
  }
  if (password && password.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errEl.style.display = '';
    return;
  }
  if (password && password !== password2) {
    errEl.textContent = 'Las contraseñas no coinciden.';
    errEl.style.display = '';
    return;
  }

  // Verificar duplicado localmente antes de ir al servidor (más rápido)
  if (!editingId) {
    const alreadyExists = USERS.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (alreadyExists) return showUfError(`El usuario "${username}" ya existe. Elige otro nombre.`);
  }

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    if (editingId) {
      const body = { username, role };
      if (password) body.newPassword = password;
      await api.patch(`/auth/users/${editingId}`, body);
      showToast('Usuario actualizado', `"${username}" modificado correctamente.`);
    } else {
      await api.post('/auth/users', { username, password, role });
      showToast('Usuario creado', `"${username}" fue creado correctamente.`);
    }
    closeUserForm();
    await loadUsers();
  } catch (e) {
    errEl.textContent   = e.message || 'Error al guardar.';
    errEl.style.display = '';
  } finally {
    btn.disabled    = false;
    btn.textContent = editingId ? 'Guardar cambios' : 'Crear usuario';
  }
}

async function toggleUserEnabled(userId, currentEnabled) {
  const u = _usersCache.find(x => String(x.id) === String(userId));
  const action = currentEnabled ? 'desactivar' : 'activar';
  if (!confirm(`¿Seguro que deseas ${action} al usuario "${u?.username}"?`)) return;
  try {
    await api.patch(`/auth/users/${userId}`, { enabled: !currentEnabled });
    showToast('Usuario actualizado', `Usuario ${currentEnabled ? 'desactivado' : 'activado'} correctamente.`);
    await loadUsers();
  } catch (e) {
    showToast('Error', e.message || 'No se pudo actualizar el usuario.', 'error');
  }
}



/* ════════════════════════════════════════════════════════════════
   MÓDULO CERTIFICADO GPS
   - openCertModal(): abre el modal prellenando datos de _valUnit
   - generarCertificadoPDF(): genera el PDF con jsPDF + QR
   - Código UUID único embebido en QR para validación futura
════════════════════════════════════════════════════════════════ */

/* ── UUID simple (crypto.randomUUID con fallback) ── */
function _certUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Helpers ── */
function _certFechaLarga(dateStr) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
}

function regenerarCodigoCert() {
  document.getElementById('cert-codigo').value = _certUUID();
}

/* ── Abrir modal ── */
/* ── Cargador dinámico de librerías de certificado ── */
let _certLibsLoaded = false;
function _loadCertLibs() {
  if (_certLibsLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    ];
    let loaded = 0;
    scripts.forEach(src => {
      const s = document.createElement('script');
      s.src = src;
      s.onload  = () => { if (++loaded === scripts.length) { _certLibsLoaded = true; resolve(); } };
      s.onerror = () => reject(new Error('No se pudo cargar: ' + src));
      document.head.appendChild(s);
    });
  });
}

function openCertModal() {
  // Precargar librerías en paralelo mientras se abre el modal
  _loadCertLibs().catch(err => console.warn('Cert libs:', err));

  // Prellenar con datos de la unidad actual
  const u = _valUnit || {};
  document.getElementById('cert-empresa').value      = u.name  || '';
  document.getElementById('cert-rut').value          = u.rut   || '';
  document.getElementById('cert-patente').value      = (u.plate || '').toUpperCase();
  document.getElementById('cert-imei').value         = u.imei  || '';
  document.getElementById('cert-fecha').value        = new Date().toISOString().slice(0, 10);
  document.getElementById('cert-validez').value      = 'years:1';
  document.getElementById('cert-firmante').value     = 'Pablo Soto';
  document.getElementById('cert-rut-firmante').value = '15.563.666-1';
  document.getElementById('cert-codigo').value       = _certUUID();

  document.getElementById('cert-modal').classList.add('show');
}

/* ── Cerrar modal ── */
function closeCertModal() {
  document.getElementById('cert-modal').classList.remove('show');
}

/* ── Extraer datos del formulario del modal ── */
function _getCertFormData() {
  const validez   = document.getElementById('cert-validez').value || 'years:1';
  const [tipo, n] = validez.split(':');
  const num       = parseInt(n, 10);
  const fechaBase = new Date(document.getElementById('cert-fecha').value || new Date().toISOString().slice(0,10));
  const fechaVenc = new Date(fechaBase);
  if (tipo === 'days')   fechaVenc.setDate(fechaVenc.getDate() + num);
  if (tipo === 'months') fechaVenc.setMonth(fechaVenc.getMonth() + num);
  if (tipo === 'years')  fechaVenc.setFullYear(fechaVenc.getFullYear() + num);

  const validezTextoMap = {
    'days:15': '15 (Quince) días', 'days:30': '30 (Treinta) días',
    'months:6': '06 (Seis) meses', 'years:1': '01 (Un) año', 'years:2': '02 (Dos) años'
  };

  return {
    empresa:   document.getElementById('cert-empresa').value.trim(),
    rut:       document.getElementById('cert-rut').value.trim(),
    patente:   document.getElementById('cert-patente').value.trim().toUpperCase(),
    imei:      document.getElementById('cert-imei').value.trim(),
    firmante:  document.getElementById('cert-firmante').value.trim(),
    rutFirm:   document.getElementById('cert-rut-firmante').value.trim(),
    fechaStr:  document.getElementById('cert-fecha').value || new Date().toISOString().slice(0,10),
    codigo:    document.getElementById('cert-codigo').value.trim(),
    validez,
    validezTexto: validezTextoMap[validez] || validez,
    fechaVencimiento: fechaVenc,
  };
}

/* ── Guardar solo en backend (sin generar PDF) ── */
async function guardarSoloCertificado() {
  const btn = event?.target?.closest('button');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  const d = _getCertFormData();
  if (!d.patente || !d.imei) {
    showToast('Error', 'Patente e IMEI son obligatorios.');
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar'; }
    return;
  }

  try {
    await api.post('/certificados', {
      id:               d.codigo,
      patente:          d.patente,
      imei:             d.imei,
      empresa:          d.empresa  || null,
      rut_empresa:      d.rut      || null,
      firmante:         d.firmante || null,
      rut_firmante:     d.rutFirm  || null,
      fecha_emision:    d.fechaStr,
      fecha_vencimiento: d.fechaVencimiento.toISOString().slice(0, 10),
      validez_texto:    d.validezTexto,
    });
    showToast('Certificado', `✅ Certificado registrado para ${d.patente}`);
    closeCertModal();
  } catch (e) {
    showToast('Error', 'No se pudo registrar el certificado.');
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar'; }
  }
}

/* ── Generar PDF ── */
async function generarCertificadoPDF() {
  // Asegurar que las librerías estén cargadas
  try { await _loadCertLibs(); } catch(e) {
    showToast('Error', 'No se pudieron cargar las librerías del certificado.'); return;
  }
  const empresa    = document.getElementById('cert-empresa').value.trim();
  const rut        = document.getElementById('cert-rut').value.trim();
  const patente    = document.getElementById('cert-patente').value.trim().toUpperCase();
  const imei       = document.getElementById('cert-imei').value.trim();
  const fechaStr   = document.getElementById('cert-fecha').value;
  const validezRaw = document.getElementById('cert-validez').value; // "days:15", "months:6", "years:1"
  const [validezTipo, validezNum] = validezRaw.split(':');
  const validezN   = parseInt(validezNum, 10);
  const firmante   = document.getElementById('cert-firmante').value.trim();
  const rutFirm    = document.getElementById('cert-rut-firmante').value.trim();
  const codigo     = document.getElementById('cert-codigo').value.trim();

  if (!patente || !imei) {
    showToast('Certificado', 'La patente y el IMEI son obligatorios.'); return;
  }

  /* ── Calcular fecha vencimiento ── */
  const fechaEmision     = new Date(fechaStr + 'T12:00:00');
  const fechaVencimiento = new Date(fechaEmision);
  if (validezTipo === 'days')   fechaVencimiento.setDate(fechaVencimiento.getDate() + validezN);
  if (validezTipo === 'months') fechaVencimiento.setMonth(fechaVencimiento.getMonth() + validezN);
  if (validezTipo === 'years')  fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + validezN);

  const _vMap = { 'days:15':'15 (Quince) días', 'days:30':'30 (Treinta) días',
                  'months:6':'06 (Seis) meses', 'years:1':'01 (Un) año', 'years:2':'02 (Dos) años' };
  const validezTexto = _vMap[validezRaw] || `${validezN} ${validezTipo}`;

  /* ── Generar QR como dataURL ── */
  const qrUrl = `${location.origin}/certificado.html?id=${codigo}`;
  const qrDataUrl = await new Promise(resolve => {
    const div = document.createElement('div');
    div.style.display = 'none';
    document.body.appendChild(div);
    const qr = new QRCode(div, {
      text: qrUrl, width: 128, height: 128,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    setTimeout(() => {
      const img = div.querySelector('img') || div.querySelector('canvas');
      const url = img ? (img.tagName === 'IMG' ? img.src : img.toDataURL()) : null;
      document.body.removeChild(div);
      resolve(url);
    }, 300);
  });

  /* ══════════════════════════════════════════════
     CONSTRUIR PDF con jsPDF
  ══════════════════════════════════════════════ */
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const ml = 25, mr = 25; // márgenes
  const cw = W - ml - mr; // ancho útil

  /* ── Colores corporativos Síguelo GPS ── */
  const VERDE  = [22,  163,  74];
  const NEGRO  = [17,  24,   39];
  const GRIS   = [100, 116, 139];
  const GRIS_L = [241, 245, 249];
  const AMARILLO = [234, 179, 8];

  let y = 0;

  /* ── HEADER con fondo verde ── */
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, W, 38, 'F');

  /* Logo texto "Síguelo | gps" */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Síguelo', ml, 20);

  doc.setTextColor(...AMARILLO);
  doc.text('| gps', ml + 35, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255, 0.8);
  doc.text('Tecnologías de rastreo y seguridad limitada', ml, 28);
  doc.text('RUT: 76.420.512-K', ml, 33.5);

  /* Línea decorativa lateral derecha */
  doc.setFillColor(...AMARILLO);
  doc.rect(W - 8, 0, 8, 38, 'F');

  y = 60;

  /* ── TÍTULO ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...NEGRO);
  doc.text('Certificado', W / 2, y, { align: 'center' });

  y += 18;

  /* ── CUERPO texto ── */
  const empresa_bold   = empresa  || '[Empresa]';
  const rut_bold       = rut      || '[RUT]';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...NEGRO);

  const texto1 = `Por medio de la presente, Tecnologías de rastreo y seguridad limitada Rut: 76.420.512-K, representada por ${firmante}, Rut ${rutFirm}, certifica que el vehículo más adelante individualizado, perteneciente a la empresa`;
  const lines1 = doc.splitTextToSize(texto1, cw);
  doc.text(lines1, ml, y, { align: 'justify', maxWidth: cw });
  y += lines1.length * 5.5;

  /* Empresa en negrita */
  doc.setFont('helvetica', 'bolditalic');
  doc.text(`${empresa_bold}, RUT: ${rut_bold},`, ml, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  const texto2 = 'se encuentra equipado con dispositivo de localización GPS para control de velocidad y logística.';
  const lines2 = doc.splitTextToSize(texto2, cw);
  doc.text(lines2, ml, y, { align: 'justify', maxWidth: cw });
  y += lines2.length * 5.5 + 12;

  /* ── TABLA PPU / IMEI ── */
  const thH = 9, tdH = 11;
  const col1 = ml, col2 = ml + cw / 2;
  const tw   = cw;

  // Header tabla
  doc.setFillColor(...NEGRO);
  doc.rect(col1, y, tw, thH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('PPU', col1 + tw / 4, y + 6.2, { align: 'center' });
  doc.text('IMEI', col1 + (tw * 3) / 4, y + 6.2, { align: 'center' });

  // Borde y fila datos
  y += thH;
  doc.setDrawColor(...GRIS);
  doc.setLineWidth(0.3);
  doc.rect(col1, y, tw / 2, tdH);
  doc.rect(col1 + tw / 2, y, tw / 2, tdH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NEGRO);
  doc.text(patente, col1 + tw / 4, y + 7.5, { align: 'center' });
  doc.text(imei,    col1 + (tw * 3) / 4, y + 7.5, { align: 'center' });
  y += tdH + 14;

  /* ── TEXTO VALIDEZ ── */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...NEGRO);
  const texto3 = `Se extiende este certificado a expresa petición del interesado para los fines que estime convenientes, y con una validez de ${validezTexto} desde la fecha de emisión, ${_certFechaLarga(fechaStr)}.`;
  const lines3 = doc.splitTextToSize(texto3, cw);
  doc.text(lines3, ml, y, { align: 'justify', maxWidth: cw });
  y += lines3.length * 5.5 + 10;

  /* ── CÓDIGO ÚNICO ── */
  doc.setFillColor(...GRIS_L);
  doc.roundedRect(ml, y, cw, 10, 2, 2, 'F');
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(`Código de certificado: ${codigo}`, ml + 4, y + 6.5);
  y += 18;

  /* ── FIRMA DIGITAL ── */
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(...GRIS);
  doc.text('El presente documento posee firma digital para garantizar su autenticidad.', ml, y, { align: 'justify', maxWidth: cw });
  y += 16;

  /* ── ATENTAMENTE ── */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...NEGRO);
  doc.text('Atentamente,', ml, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.text(firmante, ml, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('Síguelo GPS', ml, y);
  y += 6;
  doc.setTextColor(22, 163, 74);
  doc.text('soporte@siguelogps.cl', ml, y);
  doc.setTextColor(...NEGRO);

  /* ── QR de validación (esquina inferior derecha del contenido) ── */
  if (qrDataUrl) {
    const qrSize = 28;
    const qrX = W - mr - qrSize;
    const qrY = H - 55;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    doc.text('Validar documento', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
  }

  /* ── FOOTER ── */
  doc.setFillColor(...NEGRO);
  doc.rect(0, H - 18, W, 18, 'F');
  doc.setFillColor(...AMARILLO);
  doc.rect(0, H - 18, 6, 18, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'Tecnologías de rastreo y seguridad limitada, San Pio X 2460, oficina 706, providencia.',
    W / 2, H - 11, { align: 'center' }
  );
  doc.setTextColor(...AMARILLO);
  doc.textWithLink('www.siguelogps.cl', W / 2 - 20, H - 5.5, { url: 'https://www.siguelogps.cl', align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.text(' / ', W / 2, H - 5.5, { align: 'center' });
  doc.setTextColor(...AMARILLO);
  doc.textWithLink('info@siguelogps.cl', W / 2 + 16, H - 5.5, { url: 'mailto:info@siguelogps.cl', align: 'center' });

  /* ── Guardar ── */
  const filename = `Certificado_GPS_${patente}_${fechaStr}.pdf`;
  doc.save(filename);
  closeCertModal();

  /* ── Registrar certificado en el backend (fire & forget) ── */
  const API = typeof API_BASE !== 'undefined' ? API_BASE
    : 'https://app-validaciones-production.up.railway.app';
  api.post('/certificados', {
    id:               codigo,
    patente,
    imei,
    empresa:          empresa  || null,
    rut_empresa:      rut      || null,
    firmante:         firmante || null,
    rut_firmante:     rutFirm  || null,
    fecha_emision:    fechaStr,
    fecha_vencimiento: fechaVencimiento.toISOString().slice(0, 10),
    validez_texto:    validezTexto,
  }).then(() => {
    showToast('Certificado', `✅ PDF generado y registrado: ${filename}`);
  }).catch(() => {
    showToast('Certificado', `⚠️ PDF generado (sin registrar en servidor): ${filename}`);
  });
}

/* ════════════════════════════════════════════════════════════════
   MÓDULO GESTIÓN DE CERTIFICADOS (Configuración → Certificados)
════════════════════════════════════════════════════════════════ */

let _allCerts = [];   // cache para filtrar sin re-fetch

/* ══════════════════════════════════════════════════════════════════
   CERTIFICADOS MASIVOS — agregar a app.js
   Funciones nuevas:
     openCertBulkModal()     — modal emisión masiva por cliente
     _certBulkRender()       — renderiza unidades del cliente seleccionado
     emitirCertsBulk()       — llama POST /certificados/bulk
     _certToggleAll(chk)     — seleccionar/deseleccionar todos
     invalidarSeleccionados() — llama PATCH /certificados/bulk/invalidar
     eliminarSeleccionados()  — llama DELETE /certificados/bulk
══════════════════════════════════════════════════════════════════ */

/* ── Estado selección en tabla ─────────────────────────────────── */
let _certSelected = new Set();

function _certUpdateBulkBar() {
  const n   = _certSelected.size;
  const bar = document.getElementById('cert-bulk-bar');
  if (!bar) return;
  bar.style.display = n > 0 ? 'flex' : 'none';
  const lbl = bar.querySelector('#cert-bulk-label');
  if (lbl) lbl.textContent = `${n} certificado${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;

  // Habilitar "Eliminar" solo si todos los seleccionados son eliminables
  const certs = window._allCerts || [];
  const selCerts = certs.filter(c => _certSelected.has(c.id));
  const todosEliminables = selCerts.length > 0 && selCerts.every(c =>
    c.estado === 'invalidado' || c.estado === 'vencido' ||
    (c.estado === 'vigente' && new Date(c.fecha_vencimiento) < new Date())
  );
  const btnEl = bar.querySelector('#cert-btn-eliminar-sel');
  if (btnEl) btnEl.disabled = !todosEliminables;
}

function _certChkChange(id, chk) {
  chk.checked ? _certSelected.add(id) : _certSelected.delete(id);
  _certUpdateBulkBar();
}

function _certToggleAll(chk) {
  document.querySelectorAll('.cert-row-chk').forEach(c => {
    c.checked = chk.checked;
    chk.checked ? _certSelected.add(c.dataset.id) : _certSelected.delete(c.dataset.id);
  });
  _certUpdateBulkBar();
}

async function invalidarSeleccionados() {
  if (!_certSelected.size) return;
  const ids = [..._certSelected];
  if (!confirm(`¿Invalidar ${ids.length} certificado${ids.length !== 1 ? 's' : ''}?`)) return;
  try {
    await api.patch('/certificados/bulk/invalidar', { ids });
    _certSelected.clear();
    await loadCertificados();
  } catch (e) {
    alert('Error al invalidar: ' + e.message);
  }
}

async function eliminarSeleccionados() {
  if (!_certSelected.size) return;
  const ids = [..._certSelected];
  if (!confirm(`¿Eliminar ${ids.length} certificado${ids.length !== 1 ? 's' : ''}?\nSolo se eliminarán los vencidos o invalidados.`)) return;
  try {
    const res = await api.delete('/certificados/bulk', { ids });
    if (res.errors?.length) alert(`${res.deleted} eliminados. ${res.errors.length} no pudieron eliminarse.`);
    _certSelected.clear();
    await loadCertificados();
  } catch (e) {
    alert('Error al eliminar: ' + e.message);
  }
}

/* ── Modal emisión masiva ───────────────────────────────────────── */
let _bulkClientes  = [];
let _bulkUnidades  = [];

async function openCertBulkModal() {
  let modal = document.getElementById('cert-bulk-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cert-bulk-modal';
    modal.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;
      align-items:center;justify-content:center;
      background:rgba(0,0,0,.6);backdrop-filter:blur(4px);`;
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';

  // Cargar clientes y unidades en paralelo
  try {
    const [clientes, units] = await Promise.all([
      api.get('/clientes'),
      api.get('/units'),
    ]);
    _bulkClientes = clientes.filter(c => c.enabled !== false);
    _bulkUnidades = units.filter(u => u.enabled);
  } catch (e) {
    modal.innerHTML = `<div style="background:var(--bg1);border-radius:12px;padding:32px;color:var(--red)">
      Error al cargar datos: ${e.message}</div>`;
    return;
  }

  const today     = new Date().toISOString().slice(0,10);
  const nextYear  = new Date(Date.now() + 365*24*60*60*1000).toISOString().slice(0,10);

  modal.innerHTML = `
    <div style="background:var(--bg1);border:1px solid var(--border);border-radius:12px;
      width:min(780px,95vw);max-height:90vh;display:flex;flex-direction:column;
      box-shadow:0 20px 60px rgba(0,0,0,.5)">

      <!-- Header -->
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);
        display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">📋</span>
          <div>
            <div style="font-weight:700;font-size:15px">Emisión masiva de certificados</div>
            <div style="font-size:12px;color:var(--text3)">Selecciona un cliente y sus unidades</div>
          </div>
        </div>
        <button onclick="document.getElementById('cert-bulk-modal').style.display='none'"
          style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);
            background:transparent;cursor:pointer;color:var(--text2);font-size:16px">✕</button>
      </div>

      <!-- Paso 1: Cliente + campos comunes -->
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:grid;
        grid-template-columns:1fr 1fr;gap:12px">
        <div style="grid-column:1/-1">
          <label class="label">Cliente</label>
          <select id="bulk-cliente" class="input" onchange="_certBulkRender()" style="width:100%;cursor:pointer">
            <option value="">— Seleccionar cliente —</option>
            ${_bulkClientes.map(c => `<option value="${c.id}">${c.name}${c.rut ? ' · '+c.rut : ''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="label">Empresa (en certificado)</label>
          <input id="bulk-empresa" class="input" placeholder="Nombre empresa" style="width:100%"/>
        </div>
        <div>
          <label class="label">RUT empresa</label>
          <input id="bulk-rut-empresa" class="input" placeholder="12.345.678-9" style="width:100%"/>
        </div>
        <div>
          <label class="label">Firmante</label>
          <input id="bulk-firmante" class="input" placeholder="Nombre firmante" style="width:100%"/>
        </div>
        <div>
          <label class="label">RUT firmante</label>
          <input id="bulk-rut-firmante" class="input" placeholder="9.876.543-2" style="width:100%"/>
        </div>
        <div>
          <label class="label">Fecha emisión</label>
          <input id="bulk-f-emision" type="date" class="input" value="${today}" style="width:100%"/>
        </div>
        <div>
          <label class="label">Fecha vencimiento</label>
          <input id="bulk-f-vencimiento" type="date" class="input" value="${nextYear}" style="width:100%"/>
        </div>
      </div>

      <!-- Paso 2: Tabla de unidades del cliente -->
      <div style="overflow-y:auto;flex:1;min-height:100px" id="bulk-units-wrap">
        <div style="padding:24px;text-align:center;color:var(--text3)">
          Selecciona un cliente para ver sus unidades
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:12px 20px;border-top:1px solid var(--border);
        display:flex;justify-content:space-between;align-items:center">
        <span id="bulk-count-label" style="font-size:12px;color:var(--text3)"></span>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('cert-bulk-modal').style.display='none'"
            class="btn sm">Cancelar</button>
          <button onclick="emitirCertsBulk()" class="btn sm primary" id="bulk-btn-emitir" disabled>
            Emitir certificados
          </button>
        </div>
      </div>
    </div>`;
}

function _certBulkRender() {
  const clienteId = document.getElementById('bulk-cliente')?.value;
  const wrap      = document.getElementById('bulk-units-wrap');
  const btnEmitir = document.getElementById('bulk-btn-emitir');
  if (!clienteId || !wrap) return;

  const units = _bulkUnidades.filter(u => u.cliente_id === clienteId);

  if (!units.length) {
    wrap.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3)">
      Este cliente no tiene unidades activas asignadas.</div>`;
    if (btnEmitir) btnEmitir.disabled = true;
    return;
  }

  // Auto-rellenar empresa con el nombre del cliente
  const cliente = _bulkClientes.find(c => c.id === clienteId);
  const empInput = document.getElementById('bulk-empresa');
  if (empInput && !empInput.value && cliente) empInput.value = cliente.name;

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg2);font-size:11px;text-transform:uppercase;
        letter-spacing:.5px;color:var(--text3);position:sticky;top:0">
        <th style="padding:8px 12px;width:36px">
          <input type="checkbox" id="bulk-chk-all" onchange="_bulkToggleAll(this)"
            title="Seleccionar todas"/>
        </th>
        <th style="padding:8px 12px;text-align:left;font-weight:600">Patente</th>
        <th style="padding:8px 12px;text-align:left;font-weight:600">IMEI</th>
        <th style="padding:8px 12px;text-align:left;font-weight:600">Nombre</th>
      </tr></thead>
      <tbody>
        ${units.map(u => `
          <tr style="border-bottom:1px solid var(--border)"
            onmouseenter="this.style.background='var(--bg2)'"
            onmouseleave="this.style.background=''">
            <td style="padding:8px 12px">
              <input type="checkbox" class="bulk-unit-chk" data-imei="${u.imei}"
                data-plate="${u.plate||''}" checked onchange="_bulkChkChange()"/>
            </td>
            <td style="padding:8px 12px;font-weight:600;font-family:monospace">${u.plate||'—'}</td>
            <td style="padding:8px 12px;font-size:12px;color:var(--text2);font-family:monospace">${u.imei}</td>
            <td style="padding:8px 12px;font-size:12px;color:var(--text2)">${u.name||'—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  _bulkChkChange();
}

function _bulkToggleAll(chk) {
  document.querySelectorAll('.bulk-unit-chk').forEach(c => c.checked = chk.checked);
  _bulkChkChange();
}

function _bulkChkChange() {
  const n = document.querySelectorAll('.bulk-unit-chk:checked').length;
  const lbl = document.getElementById('bulk-count-label');
  if (lbl) lbl.textContent = n > 0 ? `${n} unidad${n !== 1 ? 'es' : ''} seleccionada${n !== 1 ? 's' : ''}` : '';
  const btn = document.getElementById('bulk-btn-emitir');
  if (btn) btn.disabled = n === 0;
  // Sincronizar checkbox cabecera
  const all  = document.querySelectorAll('.bulk-unit-chk').length;
  const chkAll = document.getElementById('bulk-chk-all');
  if (chkAll) { chkAll.checked = n === all; chkAll.indeterminate = n > 0 && n < all; }
}

async function emitirCertsBulk() {
  const empresa        = document.getElementById('bulk-empresa')?.value.trim()       || '';
  const rut_empresa    = document.getElementById('bulk-rut-empresa')?.value.trim()   || '';
  const firmante       = document.getElementById('bulk-firmante')?.value.trim()      || '';
  const rut_firmante   = document.getElementById('bulk-rut-firmante')?.value.trim()  || '';
  const fecha_emision  = document.getElementById('bulk-f-emision')?.value            || '';
  const fecha_vencimiento = document.getElementById('bulk-f-vencimiento')?.value     || '';

  if (!fecha_emision || !fecha_vencimiento)
    return alert('Completa las fechas de emisión y vencimiento.');

  const checks = [...document.querySelectorAll('.bulk-unit-chk:checked')];
  if (!checks.length) return alert('Selecciona al menos una unidad.');

  const certificados = checks.map(c => ({
    patente: c.dataset.plate || '',
    imei:    c.dataset.imei  || '',
    empresa, rut_empresa, firmante, rut_firmante,
    fecha_emision, fecha_vencimiento,
    validez_texto: '1 año',
  }));

  const btn = document.getElementById('bulk-btn-emitir');
  if (btn) { btn.disabled = true; btn.textContent = 'Emitiendo…'; }

  try {
    const res = await api.post('/certificados/bulk', { certificados });
    document.getElementById('cert-bulk-modal').style.display = 'none';

    let msg = `✅ ${res.created} certificado${res.created !== 1 ? 's' : ''} emitido${res.created !== 1 ? 's' : ''} correctamente.`;
    if (res.errors?.length) msg += `\n⚠ ${res.errors.length} no pudieron emitirse.`;
    alert(msg);

    await loadCertificados();
  } catch (e) {
    alert('Error al emitir: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Emitir certificados'; }
  }
}

async function loadCertificados() {
  const wrap = document.getElementById('cert-list-wrap');
  if (!wrap) return;

  wrap.innerHTML = `<div style="padding:28px;text-align:center;color:var(--text2);font-size:13px">
    <div style="display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid rgba(148,163,184,.2);border-top-color:#38bdf8;animation:spin .8s linear infinite;margin-bottom:8px"></div><br>Cargando…</div>`;

  try {
    _allCerts = await api.get('/certificados');
    _renderCertTable();
  } catch (e) {
    wrap.innerHTML = `<div style="padding:28px;text-align:center;color:#fca5a5;font-size:13px">Error al cargar certificados.</div>`;
  }
}

function _renderCertTable() {
  const wrap = document.getElementById('cert-list-wrap');
  if (!wrap) return;

  // Leer filtros actuales
  const q       = (document.getElementById('cert-filter-q')?.value     || '').toLowerCase().trim();
  const estado  =  document.getElementById('cert-filter-estado')?.value || 'todos';

  const hoy = new Date();
  const filtered = _allCerts.filter(cert => {
    // Estado efectivo
    let est = cert.estado;
    if (est === 'vigente' && new Date(cert.fecha_vencimiento) < hoy) est = 'vencido';

    if (estado !== 'todos' && est !== estado) return false;
    if (q && !(
      (cert.patente  || '').toLowerCase().includes(q) ||
      (cert.empresa  || '').toLowerCase().includes(q) ||
      (cert.imei     || '').toLowerCase().includes(q)
    )) return false;
    return true;
  });

  if (!filtered.length) {
    wrap.innerHTML = `
      ${_certFilterBar()}
      <div style="padding:32px;text-align:center;color:var(--text2);font-size:13px">No hay certificados que coincidan con los filtros.</div>`;
    _bindCertFilters();
    return;
  }

  wrap.innerHTML = `
    ${_certFilterBar()}
    <div id="cert-bulk-bar" style="display:none;padding:8px 16px;margin-top:8px;
      background:var(--bg2);border:1px solid var(--border);border-radius:8px;
      align-items:center;gap:10px;flex-wrap:wrap">
      <span id="cert-bulk-label" style="font-size:13px;font-weight:600;color:var(--text2)"></span>
      <button onclick="invalidarSeleccionados()" class="btn sm amber" style="margin-left:auto">
        🚫 Invalidar seleccionadas
      </button>
      <button onclick="eliminarSeleccionados()" id="cert-btn-eliminar-sel" class="btn sm danger" disabled>
        🗑 Eliminar seleccionadas
      </button>
    </div>
    <div style="overflow-x:auto;margin-top:12px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(148,163,184,.12)">
            <th style="padding:9px 12px;width:36px">
              <input type="checkbox" id="cert-chk-all" onchange="_certToggleAll(this)" title="Seleccionar todas"/>
            </th>
            ${['Patente','IMEI','Empresa','Emisión','Vencimiento','Estado','Acciones'].map(h =>
              `<th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${filtered.map(cert => _certRow(cert)).join('')}
        </tbody>
      </table>
    </div>`;
  _bindCertFilters();
}

function _certFilterBar() {
  const q      = document.getElementById('cert-filter-q')?.value     || '';
  const estado = document.getElementById('cert-filter-estado')?.value || 'todos';
  return `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div style="flex:1;min-width:180px;position:relative">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:.4" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="cert-filter-q" class="input" placeholder="Buscar patente, empresa, IMEI…"
          value="${q}" oninput="_renderCertTable()"
          style="padding-left:30px;font-size:12px" />
      </div>
      <select id="cert-filter-estado" class="input" onchange="_renderCertTable()"
        style="width:140px;font-size:12px;cursor:pointer">
        <option value="todos"     ${estado==='todos'     ?'selected':''}>Todos</option>
        <option value="vigente"   ${estado==='vigente'   ?'selected':''}>✅ Vigentes</option>
        <option value="vencido"   ${estado==='vencido'   ?'selected':''}>⏰ Vencidos</option>
        <option value="invalidado"${estado==='invalidado'?'selected':''}>🚫 Invalidados</option>
      </select>
      <span style="font-size:12px;color:var(--text2);white-space:nowrap" id="cert-count"></span>
    </div>`;
}

function _bindCertFilters() {
  // Actualizar contador
  const countEl = document.getElementById('cert-count');
  if (countEl) {
    const hoy = new Date();
    const q      = (document.getElementById('cert-filter-q')?.value     || '').toLowerCase();
    const estado =  document.getElementById('cert-filter-estado')?.value || 'todos';
    const n = _allCerts.filter(cert => {
      let est = cert.estado;
      if (est === 'vigente' && new Date(cert.fecha_vencimiento) < hoy) est = 'vencido';
      if (estado !== 'todos' && est !== estado) return false;
      if (q && !((cert.patente||'').toLowerCase().includes(q)||(cert.empresa||'').toLowerCase().includes(q)||(cert.imei||'').toLowerCase().includes(q))) return false;
      return true;
    }).length;
    countEl.textContent = `${n} resultado${n !== 1 ? 's' : ''}`;
  }
}

function _certRow(c) {
  const hoy  = new Date();
  const venc = new Date(c.fecha_vencimiento);
  let estado = c.estado;
  if (estado === 'vigente' && venc < hoy) estado = 'vencido';

  const estadoHtml = {
    vigente:    `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.2)">● Vigente</span>`,
    vencido:    `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(245,158,11,.10);color:#fcd34d;border:1px solid rgba(245,158,11,.2)">● Vencido</span>`,
    invalidado: `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(239,68,68,.10);color:#fca5a5;border:1px solid rgba(239,68,68,.2)">● Invalidado</span>`,
  }[estado] || estado;

  const fmt = d => d ? new Date(d).toLocaleDateString('es-CL') : '–';

  return `<tr style="border-bottom:1px solid rgba(148,163,184,.07);transition:background .12s"
    onmouseenter="this.style.background='rgba(255,255,255,.02)'" onmouseleave="this.style.background=''">
    <td style="padding:6px 10px;width:36px">
      <input type="checkbox" class="cert-row-chk" data-id="${c.id}"
        onchange="_certChkChange('${c.id}', this)"/>
    </td>
    <td style="padding:10px 12px;font-weight:700;letter-spacing:.5px;font-family:monospace">${c.patente}</td>
    <td style="padding:10px 12px;color:var(--text2);font-size:12px">${c.imei}</td>
    <td style="padding:10px 12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.empresa||''}">${c.empresa||'–'}</td>
    <td style="padding:10px 12px;white-space:nowrap">${fmt(c.fecha_emision)}</td>
    <td style="padding:10px 12px;white-space:nowrap">${fmt(c.fecha_vencimiento)}</td>
    <td style="padding:10px 12px">${estadoHtml}</td>
    <td style="padding:10px 12px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <a href="certificado.html?id=${c.id}" target="_blank"
          style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.15);color:#7dd3fc;text-decoration:none;white-space:nowrap">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Ver
        </a>
        ${estado !== 'invalidado'
          ? `<button onclick="invalidarCertificado('${c.id}',this)"
              style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);color:#fca5a5;cursor:pointer;white-space:nowrap">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Invalidar
            </button>`
          : `<button onclick="revalidarCertificado('${c.id}',this)"
              style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);color:#86efac;cursor:pointer;white-space:nowrap">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              Revalidar
            </button>`}
        ${(estado === 'vencido' || estado === 'invalidado')
          ? `<button onclick="eliminarCertificado('${c.id}',this)"
              style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(100,116,139,.08);border:1px solid rgba(100,116,139,.2);color:#94a3b8;cursor:pointer;white-space:nowrap">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Eliminar
            </button>`
          : ''}
      </div>
    </td>
  </tr>`;
}

async function invalidarCertificado(id, btn) {
  if (!confirm('¿Invalidar este certificado?')) return;
  btn.disabled = true; btn.textContent = 'Invalidando…';
  try {
    await api.patch(`/certificados/${id}/invalidar`, {});
    showToast('Certificados', 'Certificado invalidado.');
    await loadCertificados();
  } catch (e) {
    showToast('Error', 'No se pudo invalidar.');
    btn.disabled = false; btn.textContent = 'Invalidar';
  }
}

async function revalidarCertificado(id, btn) {
  if (!confirm('¿Reactivar este certificado como vigente?')) return;
  btn.disabled = true; btn.textContent = 'Revalidando…';
  try {
    await api.patch(`/certificados/${id}/revalidar`, {});
    showToast('Certificados', '✅ Certificado reactivado.');
    await loadCertificados();
  } catch (e) {
    showToast('Error', 'No se pudo revalidar.');
    btn.disabled = false; btn.textContent = 'Revalidar';
  }
}

async function eliminarCertificado(id, btn) {
  if (!confirm('¿Eliminar este certificado vencido? Esta acción no se puede deshacer.')) return;
  btn.disabled = true; btn.textContent = 'Eliminando…';
  try {
    await api.delete(`/certificados/${id}`);
    showToast('Certificados', 'Certificado eliminado.');
    await loadCertificados();
  } catch (e) {
    showToast('Error', 'No se pudo eliminar. Solo se pueden eliminar certificados vencidos.');
    btn.disabled = false; btn.textContent = 'Eliminar';
  }
}
/* ── Buscadores en secciones de configuración ──────────────────── */

/**
 * Filtra las filas de un <tbody> según texto en columnas indicadas.
 * @param {string} tbodyId   - ID del tbody
 * @param {string} inputId   - ID del input de búsqueda
 * @param {number[]} cols    - Índices de columnas donde buscar (0-based)
 */
function filterCfgTable(tbodyId, inputId, cols) {
  const q     = (document.getElementById(inputId)?.value || '').toLowerCase().trim();
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  let visible = 0;
  rows.forEach(tr => {
    const text = cols.map(i => tr.cells[i]?.textContent || '').join(' ').toLowerCase();
    const show = !q || text.includes(q);
    tr.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  // Mostrar fila vacía si no hay resultados
  let emptyRow = tbody.querySelector('tr.cfg-empty-row');
  if (!visible && q) {
    if (!emptyRow) {
      emptyRow = document.createElement('tr');
      emptyRow.className = 'cfg-empty-row';
      emptyRow.innerHTML = `<td colspan="10" style="text-align:center;padding:20px;color:var(--text3);font-size:13px">Sin resultados para "<em>${q}</em>"</td>`;
      tbody.appendChild(emptyRow);
    } else {
      emptyRow.style.display = '';
      emptyRow.querySelector('td').innerHTML = `Sin resultados para "<em>${q}</em>"`;
    }
  } else if (emptyRow) {
    emptyRow.style.display = 'none';
  }
}

/**
 * Filtra los items del org-list por texto.
 */
function filterOrgList() {
  const q    = (document.getElementById('orgs-search')?.value || '').toLowerCase().trim();
  const list = document.getElementById('org-list');
  if (!list) return;
  // Los items son divs con clase nav-item generados por renderOrgList en orgs.js
  const items = [...list.children].filter(el => el.classList.contains('nav-item'));
  let visible = 0;
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    const show = !q || text.includes(q);
    el.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  // Mensaje vacío
  let emptyEl = list.querySelector('.org-empty-msg');
  if (!visible && q) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'org-empty-msg';
      emptyEl.style.cssText = 'padding:12px 8px;text-align:center;font-size:12px;color:var(--text3)';
      list.appendChild(emptyEl);
    }
    emptyEl.textContent = `Sin resultados para "${q}"`;
    emptyEl.style.display = '';
  } else if (emptyEl) {
    emptyEl.style.display = 'none';
  }
}

/**
 * Filtra los dest-card del modal-dest-grid por texto.
 * Los items son divs con clase dest-card generados por _renderDestStep.
 */
function filterDestGrid() {
  const q    = (document.getElementById('dest-search')?.value || '').toLowerCase().trim();
  const grid = document.getElementById('modal-dest-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.dest-card');
  let visible = 0;
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const show = !q || text.includes(q);
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  // Mensaje vacío
  let emptyEl = grid.querySelector('.dest-empty-msg');
  if (!visible && q && cards.length) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'dest-empty-msg';
      emptyEl.style.cssText = 'text-align:center;padding:20px;color:var(--text3);font-size:13px';
      grid.appendChild(emptyEl);
    }
    emptyEl.textContent = `Sin resultados para "${q}"`;
    emptyEl.style.display = '';
  } else if (emptyEl) {
    emptyEl.style.display = 'none';
  }
}

function _renderValDestinos(status, responses) {
  const container = document.getElementById('res-destinos');
  if (!container) return;

  const targets = status?.targets || [];
  const results = (responses?.results || []);

  if (!targets.length) {
    container.innerHTML = `
      <div class="card" style="margin-top:16px">
        <div class="card-header"><h3>Integraciones / Destinos</h3></div>
        <div class="card-body">
          <div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">
            Sin destinos asignados a esta unidad
          </div>
        </div>
      </div>`;
    return;
  }

  // Agrupar eventos por nombre de destino
  const grouped = {};
  results.forEach(r => {
    const key = r.target || r.destination_id || '—';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  window._valDestinosData    = grouped;
  window._valDestinosTargets = targets;

  // Detectar destinos con campos faltantes
  const missingByDest = {};
  results.forEach(r => {
    const key = r.target || r.destination_id || '—';
    if (r.forward_resp?.startsWith('CAMPOS_FALTANTES:')) {
      if (!missingByDest[key]) missingByDest[key] = new Set();
      r.forward_resp.replace('CAMPOS_FALTANTES:', '').trim()
        .split(', ').forEach(c => missingByDest[key].add(c));
    }
  });

  function _timeAgo(ts) {
    if (!ts) return '—';
    const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 1)    return 'Ahora';
    if (mins < 60)   return `${mins} min atrás`;
    if (mins < 1440) return `${Math.round(mins / 60)} h atrás`;
    return new Date(ts).toLocaleDateString('es-CL');
  }

  const buttons = targets.map(tName => {
    const evs  = grouped[tName] || [];
    const last = evs[0];
    const ok   = last?.ok;
    let dotColor = 'var(--text3)';
    if (ok === true)  dotColor = 'var(--green)';
    if (ok === false) dotColor = 'var(--red)';
    const lastTime   = _timeAgo(last?.at);
    const hasMissing = missingByDest[tName]?.size > 0;
    const btnColor   = hasMissing ? 'rgba(251,191,36,.3)' : 'var(--border)';
    const btnBg      = hasMissing ? 'rgba(251,191,36,.04)' : 'var(--bg2)';
    const dotFinal   = hasMissing ? 'var(--amber)' : dotColor;

    const missingAlert = hasMissing ? `
      <div style="font-size:11px;color:var(--amber);background:var(--amber-dim);
        border:1px solid rgba(251,191,36,.2);border-radius:var(--radius-sm);
        padding:6px 10px;margin-top:6px;display:flex;align-items:flex-start;gap:6px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          style="flex-shrink:0;margin-top:1px">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Campos requeridos sin datos: <strong>${[...missingByDest[tName]].join(', ')}</strong>
          <br><span style="color:var(--text3)">Completa los datos en Patentes / IMEI</span></span>
      </div>` : '';

    return `
      <div>
        <button onclick="openDestModal('${tName.replace(/'/g,"\'")}', '${dotFinal}')"
          style="display:flex;align-items:center;gap:10px;padding:10px 14px;
            border-radius:var(--radius-sm);border:1px solid ${btnColor};background:${btnBg};
            cursor:pointer;text-align:left;transition:border-color .15s;width:100%"
          onmouseover="this.style.borderColor='var(--sky)'"
          onmouseout="this.style.borderColor='${btnColor}'">
          <span style="width:9px;height:9px;border-radius:99px;background:${dotFinal};flex-shrink:0;display:inline-block"></span>
          <span style="flex:1;font-size:13px;font-weight:500;color:var(--text)">${tName}</span>
          ${hasMissing ? '<span class="badge amber" style="font-size:10px">Datos incompletos</span>' : ''}
          <span style="font-size:11px;color:var(--text3)">${lastTime}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        \${missingAlert}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <h3>Integraciones / Destinos</h3>
        <button onclick="openDestModalAll()" class="btn sm primary" style="gap:5px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Ver todos
        </button>
      </div>
      <div class="card-body" style="display:grid;gap:8px;padding:12px">
        ${buttons}
      </div>
    </div>`;
}


// ─── Abrir modal con todos los destinos (sidebar + detalle) ─────
function openDestModalAll() {
  _openDestModalBase();
  const targets = window._valDestinosTargets || [];
  const grouped = window._valDestinosData   || {};
  const first = targets.find(t => (grouped[t]||[]).length > 0) || targets[0];
  if (first) setTimeout(() => _destModalSelectTab(first), 50);
}

function openDestModal(tName, dotColor) {
  _openDestModalBase();
  setTimeout(() => _destModalSelectTab(tName), 50);
}

function _openDestModalBase() {
  const overlay = document.getElementById('dest-modal-overlay');
  if (!overlay) return;

  const targets = window._valDestinosTargets || [];
  const grouped = window._valDestinosData   || {};

  // ── Si el nuevo layout no existe en el HTML, inyectarlo ──────
  if (!document.getElementById('dest-modal-sidebar')) {
    overlay.style.cssText = '';
    overlay.className = 'modal-overlay';
    overlay.onclick = e => { if (e.target === overlay) closeDestModal(); };
    overlay.innerHTML = `
      <div class="dest-modal-shell">
        <div class="dest-modal-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:28px;height:28px;border-radius:8px;background:var(--sky-dim);
              display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--sky)" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <h3 style="font-size:14px;font-weight:600">Integraciones / Destinos</h3>
            <span id="dest-modal-badge" class="badge sky"></span>
          </div>
          <button class="btn sm" onclick="closeDestModal()"
            style="width:28px;height:28px;padding:0;justify-content:center;flex-shrink:0">✕</button>
        </div>
        <div class="dest-modal-content">
          <div id="dest-modal-sidebar" class="dest-modal-sidebar"></div>
          <div id="dest-modal-body" class="dest-modal-body">
            <div class="empty-state" style="padding:48px 20px"><p>Selecciona un destino</p></div>
          </div>
        </div>
      </div>`;
  }

  // Poblar sidebar
  const sidebar = document.getElementById('dest-modal-sidebar');
  const badge   = document.getElementById('dest-modal-badge');
  if (badge) badge.textContent = `${targets.length} destino${targets.length !== 1 ? 's' : ''}`;

  if (sidebar) {
    sidebar.innerHTML = targets.map(tName => {
      const evs  = grouped[tName] || [];
      const last = evs[0];
      const ok   = last?.ok;
      let dot = '#64748b';
      if (ok === true)  dot = '#22c55e';
      if (ok === false) dot = '#ef4444';
      return `
        <button id="dest-tab-${tName.replace(/\W/g,'_')}"
          onclick="_destModalSelectTab('${tName.replace(/'/g,"\'")}', this)"
          style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;
            border:1px solid transparent;background:transparent;cursor:pointer;
            text-align:left;width:100%;transition:background .12s;font-family:inherit">
          <span style="width:8px;height:8px;border-radius:99px;background:${dot};flex-shrink:0"></span>
          <span style="font-size:12px;font-weight:500;color:var(--text);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${tName}</span>
          <span style="font-size:10px;color:var(--text3);flex-shrink:0">${evs.length}</span>
        </button>`;
    }).join('');
  }

  // Mostrar — compatible con class.show Y display directo
  overlay.classList.add('show');
  overlay.style.display = 'flex';
}

function closeDestModal() {
  const ov = document.getElementById('dest-modal-overlay');
  if (!ov) return;
  ov.classList.remove('show');
  ov.style.display = 'none';
}

function closeDestModal() {
  const ov = document.getElementById('dest-modal-overlay');
  if (!ov) return;
  ov.classList.remove('show');
  ov.style.display = 'none';
}

function _destModalSelectTab(tName, btnEl) {
  // Highlight tab activo
  document.querySelectorAll('#dest-modal-sidebar .dest-sidebar-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = btnEl || document.querySelector('#dest-modal-sidebar .dest-sidebar-btn');
  if (activeBtn) activeBtn.classList.add('active');

  const body    = document.getElementById('dest-modal-body');
  const grouped = window._valDestinosData || {};
  const evs     = grouped[tName] || [];

  function _fmt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-CL');
  }

  if (!evs.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:40px 20px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          style="width:32px;height:32px;margin-bottom:10px;opacity:.3">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <p>Sin envíos para <strong>${tName}</strong></p>
        <small>Los envíos aparecerán aquí en cuanto la unidad transmita</small>
      </div>`;
    return;
  }

  const last = evs[0];

  // ── Resumen del último envío ──────────────────────────────────
  const summaryHTML = `
    <div class="dest-detail-stats">
      <div class="dest-stat-card">
        <div class="dest-stat-label">Destino</div>
        <div class="dest-stat-value">${tName}</div>
      </div>
      <div class="dest-stat-card">
        <div class="dest-stat-label">Total envíos</div>
        <div class="dest-stat-value">${evs.length}</div>
      </div>
      <div class="dest-stat-card">
        <div class="dest-stat-label">Último envío</div>
        <div class="dest-stat-value" style="font-size:13px">${_fmt(last.at)}</div>
      </div>
      <div class="dest-stat-card">
        <div class="dest-stat-label">Último resultado</div>
        <div>${last.ok === null || last.ok === undefined
          ? `<span style="color:var(--text3);font-size:12px">Sin datos</span>`
          : last.ok
            ? `<span class="badge green">${(last.response || '200 OK').slice(0,30)}</span>`
            : `<span class="badge red">${(last.response || 'Error').slice(0,40)}</span>`
        }</div>
      </div>
      ${last.tx?.lat ? `
      <div style="grid-column:span 2;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px">
        <div class="label" style="margin-bottom:4px">Última posición</div>
        <div style="font-size:12px;font-family:'DM Mono',monospace;color:var(--sky)">
          ${parseFloat(last.tx.lat).toFixed(6)}, ${parseFloat(last.tx.lon).toFixed(6)}
          ${last.tx.speed !== null && last.tx.speed !== undefined ? ` · ${last.tx.speed} km/h` : ''}
        </div>
      </div>` : ''}
    </div>`;

  // ── Tabla de historial paginada ───────────────────────────────
  const PAGE = 20;
  let page = 0;

  function renderPage() {
    const slice = evs.slice(page * PAGE, (page + 1) * PAGE);
    const ok_count  = evs.filter(e => e.ok === true).length;
    const err_count = evs.filter(e => e.ok === false).length;

    body.innerHTML = summaryHTML + `
      <!-- Estadísticas rápidas -->
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span class="badge green">✅ ${ok_count} OK</span>
        <span class="badge red">❌ ${err_count} Error</span>
        ${evs.length - ok_count - err_count > 0
          ? `<span class="badge" style="background:var(--bg2)">⬜ ${evs.length - ok_count - err_count} Sin datos</span>` : ''}
      </div>

      <!-- Cabecera historial -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="label">Historial de envíos</div>
        <span style="font-size:11px;color:var(--text3)">
          ${page * PAGE + 1}–${Math.min((page+1)*PAGE, evs.length)} de ${evs.length}
        </span>
      </div>

      <!-- Tabla -->
      <div class="table-wrap" style="max-height:300px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Resultado</th>
              <th>Respuesta</th>
              <th>Velocidad</th>
            </tr>
          </thead>
          <tbody>
            ${slice.map(e => `
              <tr style="border-top:1px solid var(--border)"
                onmouseenter="this.style.background='var(--bg2)'"
                onmouseleave="this.style.background=''">
                <td style="padding:7px 12px;white-space:nowrap;color:var(--text2)">${_fmt(e.at)}</td>
                <td style="padding:7px 12px">
                  ${e.ok === true  ? '<span class="badge green" style="font-size:10px">OK</span>'
                  : e.ok === false ? '<span class="badge red" style="font-size:10px">Error</span>'
                  :                  '<span style="color:var(--text3);font-size:11px">—</span>'}
                </td>
                <td style="padding:7px 12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;
                  white-space:nowrap;font-family:monospace;font-size:11px;color:var(--text2)"
                  title="${(e.response||'').replace(/"/g,'&quot;')}">
                  ${e.response ? e.response.slice(0,60) : '—'}
                </td>
                <td style="padding:7px 12px;color:var(--text2)">
                  ${e.tx?.speed !== null && e.tx?.speed !== undefined ? e.tx.speed + ' km/h' : '—'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      ${evs.length > PAGE ? `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
        <button onclick="_destPage(-1)" class="btn sm" ${page === 0 ? 'disabled' : ''}>← Anterior</button>
        <span style="font-size:12px;color:var(--text3)">Página ${page+1} de ${Math.ceil(evs.length/PAGE)}</span>
        <button onclick="_destPage(1)" class="btn sm" ${(page+1)*PAGE >= evs.length ? 'disabled' : ''}>Siguiente →</button>
      </div>` : ''}`;

    window._destPage = (dir) => {
      page = Math.max(0, Math.min(Math.ceil(evs.length/PAGE)-1, page + dir));
      renderPage();
      body.scrollTop = 0;
    };
  }

  renderPage();
}


// Cerrar al hacer clic en el fondo del overlay
document.addEventListener('click', e => {
  const overlay = document.getElementById('dest-modal-overlay');
  if (e.target === overlay) closeDestModal();
});
