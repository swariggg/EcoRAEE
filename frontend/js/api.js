// Cliente de la API: agrega el token, convierte errores en mensajes claras y
// manda al login si la sesión expiró.

// Si el frontend se abre desde otro puerto (p. ej. Live Server :5500), apunta a la API en :8000.
export const API_BASE = location.port === "8000" ? "" : "http://localhost:8000";

const CLAVE = "ecoraee.sesion";

export function sesion() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE)) || null; } catch { return null; }
}
export function guardarSesion(datos) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* modo privado */ }
}
export function cerrarSesion() {
  try { sessionStorage.removeItem(CLAVE); } catch { /* nada */ }
  location.href = "login.html";
}

export class ErrorApi extends Error {
  constructor(status, detalle, campos = []) {
    super(detalle);
    this.status = status;
    this.campos = campos;
  }
}

async function pedir(metodo, ruta, cuerpo, { formulario = false } = {}) {
  const s = sesion();
  const headers = {};
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  let body;
  if (cuerpo !== undefined) {
    if (formulario) body = cuerpo;
    else { headers["Content-Type"] = "application/json"; body = JSON.stringify(cuerpo); }
  }
  let r;
  try {
    r = await fetch(API_BASE + ruta, { method: metodo, headers, body });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con la API. ¿Está corriendo uvicorn en el puerto 8000?");
  }
  if (r.status === 401 && !ruta.startsWith("/api/auth/login")) {
    cerrarSesion();
    throw new ErrorApi(401, "La sesión expiró.");
  }
  if (r.status === 204) return null;
  const tipo = r.headers.get("content-type") || "";
  const datos = tipo.includes("application/json") ? await r.json() : await r.blob();
  if (!r.ok) {
    const detalle = (datos && datos.detalle) || `Error ${r.status}`;
    throw new ErrorApi(r.status, detalle, datos?.campos || []);
  }
  return datos;
}

export const api = {
  get: (ruta) => pedir("GET", ruta),
  post: (ruta, cuerpo) => pedir("POST", ruta, cuerpo ?? {}),
  put: (ruta, cuerpo) => pedir("PUT", ruta, cuerpo),
  patch: (ruta, cuerpo) => pedir("PATCH", ruta, cuerpo),
  del: (ruta) => pedir("DELETE", ruta),
  subir: (ruta, formData) => pedir("POST", ruta, formData, { formulario: true }),
};

// Cache simple de catálogos (cambian poco)
const cache = new Map();
export async function catalogo(ruta) {
  if (!cache.has(ruta)) cache.set(ruta, api.get(ruta).catch((e) => { cache.delete(ruta); throw e; }));
  return cache.get(ruta);
}
export function limpiarCache(prefijo = "") {
  for (const k of [...cache.keys()]) if (k.startsWith(prefijo)) cache.delete(k);
}
