/**
 * store.js — Estado global en memoria
 *
 * USERS y ORGS ya no viven en localStorage.
 * Los datos vienen de la API y se cachean aquí durante la sesión.
 *
 * Lo que SÍ persiste en sessionStorage:
 *  - sgl_token  → JWT
 *  - sgl_user   → datos básicos del usuario logueado
 */


const ROLE_LABELS = { admin: 'Administrador', user: 'Operador' };
const FIELD_TYPES = ['text','number','email','tel','date','select','textarea'];
let ROLES = [];  // array desde GET /roles — roles custom
// ── Estado de sesión ─────────────────────────────────────────────
let state = {
  user:        null,
  currentView: 'dashboard',
};

// ── Caché en memoria (se llena desde la API) ─────────────────────
let USERS = [];   // array desde GET /users
let ORGS  = {};   // objeto keyed by id desde GET /destinations

// ── Helpers de conversión API ↔ formato interno ──────────────────

/**
 * Convierte un destino de la API al formato que usa el frontend
 */
function destToOrg(dest) {
  let fields = dest.field_schema ?? [];
  if (typeof fields === 'string') {
    try { fields = JSON.parse(fields); } catch (_) { fields = []; }
  }
  return {
    name:   dest.name,
    apiUrl: dest.api_url ?? '',
    color:  dest.color   ?? '#38bdf8',
    fields,
  };
}
/**
 * Convierte el formato interno al body que espera PATCH /destinations/:id
 */
function orgToDestPatch(org) {
  return {
    name:         org.name,
    api_url:      org.apiUrl  || null,
    color:        org.color   || '#38bdf8',
    field_schema: org.fields  || [],
  };
}
