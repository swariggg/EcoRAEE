// Aplicación de una sola página: menú por rol, barra superior y rutas (#/ruta/id).
import { api, cerrarSesion, sesion } from "./api.js";
import { icono, LOGO } from "./ilustraciones.js";
import { cargando, esc, mostrarError } from "./ui.js";

const s = sesion();
if (!s?.token) location.href = "login.html";
const usuario = s?.usuario || {};
const rol = usuario.id_rol;
const PERSONAL = ["ADM", "OPE", "TEC", "COO", "REA", "BEN"];

// [ruta, etiqueta, ícono, roles que la ven, grupo]
const MENU = [
  ["panel", "Inicio", "panel", null, "Operación"],
  ["solicitudes", "Solicitudes", "solicitud", ["GEN", "OPE", "COO", "ADM"], "Operación"],
  ["dispositivos", rol === "GEN" ? "Mis equipos" : "Dispositivos", "dispositivo", null, "Operación"],
  ["evaluaciones", "Evaluaciones", "evaluacion", ["TEC", "COO", "OPE", "ADM"], "Operación"],
  ["movimientos", "Movimientos", "movimiento", ["COO", "OPE", "ADM"], "Operación"],
  ["transferencias", "Destinos asignados", "transferencia", ["COO", "REA", "BEN", "ADM"], "Operación"],
  ["evidencias", "Evidencias", "evidencia", PERSONAL, "Operación"],
  ["red", "Red y flujo máximo", "red", ["COO", "ADM", "OPE", "TEC"], "Análisis"],
  ["centros", "Centros", "centro", PERSONAL, "Administración"],
  ["destinos", "Destinos", "destino", ["COO", "ADM", "OPE"], "Administración"],
  ["catalogos", "Catálogos", "catalogo", ["ADM", "COO", "TEC"], "Administración"],
  ["usuarios", "Usuarios", "usuarios", ["ADM"], "Administración"],
  ["auditoria", "Auditoría", "auditoria", ["ADM"], "Administración"],
];
const VISTAS = {
  panel: () => import("./views/panel.js"),
  solicitudes: () => import("./views/solicitudes.js"),
  dispositivos: () => import("./views/dispositivos.js"),
  evaluaciones: () => import("./views/evaluaciones.js"),
  movimientos: () => import("./views/movimientos.js"),
  transferencias: () => import("./views/transferencias.js"),
  evidencias: () => import("./views/evidencias.js"),
  red: () => import("./views/red.js"),
  centros: () => import("./views/centros.js"),
  destinos: () => import("./views/destinos.js"),
  catalogos: () => import("./views/catalogos.js"),
  usuarios: () => import("./views/usuarios.js"),
  auditoria: () => import("./views/auditoria.js"),
  alertas: () => import("./views/alertas.js"),
};
const puede = (roles) => !roles || roles.includes(rol);

// ------------------------------------------------------------------ menú superior con grupos desplegables
const nav = document.getElementById("nav");
const grupos = ["Operación", "Análisis", "Administración"];
document.getElementById("marca").innerHTML = `${LOGO}<b>EcoRAEE</b>`;
nav.innerHTML = `<a href="#/panel" data-ruta="panel">Inicio</a>${grupos.map((g) => {
  const items = MENU.filter((m) => m[4] === g && m[0] !== "panel" && puede(m[3]));
  return items.length ? `<div class="grupo" data-grupo="${g}">
    <button type="button" aria-haspopup="true" aria-expanded="false">${g}${icono("abajo")}</button>
    <div class="desplegable">${items.map(([r, t, i]) =>
      `<a href="#/${r}" data-ruta="${r}"><span class="ic">${icono(i)}</span><span>${t}</span><span class="cuenta" data-cuenta="${r}" hidden></span></a>`).join("")}</div></div>` : "";
}).join("")}`;
// Teclado y pantallas táctiles: el botón del grupo abre o cierra su lista.
nav.querySelectorAll(".grupo > button").forEach((b) => b.addEventListener("click", () => {
  const g = b.parentElement, abrir = !g.classList.contains("abierto");
  nav.querySelectorAll(".grupo").forEach((x) => { x.classList.remove("abierto"); x.firstElementChild.setAttribute("aria-expanded", "false"); });
  g.classList.toggle("abierto", abrir); b.setAttribute("aria-expanded", String(abrir));
}));
document.addEventListener("click", (e) => { if (!nav.contains(e.target)) nav.querySelectorAll(".grupo").forEach((x) => x.classList.remove("abierto")); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") nav.querySelectorAll(".grupo").forEach((x) => x.classList.remove("abierto")); });

const botonMenu = document.getElementById("abrir-menu");
botonMenu.innerHTML = icono("menu");
botonMenu.onclick = () => botonMenu.setAttribute("aria-expanded", String(nav.classList.toggle("abierto")));
window.addEventListener("scroll", () => document.getElementById("barra").classList.toggle("sombra", scrollY > 8), { passive: true });

// ------------------------------------------------------------------ barra superior
const iniciales = `${(usuario.nombres || "?")[0]}${(usuario.apellidos || "")[0] || ""}`.toUpperCase();
document.getElementById("derecha").insertAdjacentHTML("beforeend", `
  ${PERSONAL.includes(rol) ? `<a class="btn-icono" href="#/alertas" aria-label="Alertas" title="Alertas de capacidad">${icono("campana")}<span class="punto" id="n-alertas" hidden></span></a>` : ""}
  <div class="perfil" title="${esc(usuario.correo_institucional)}">
    <span class="avatar">${esc(iniciales)}</span>
    <span><div class="nombre">${esc(usuario.nombres)} ${esc(usuario.apellidos)}</div><div class="rol">${esc(usuario.nombre_rol)}</div></span>
  </div>
  <button class="btn-icono" id="salir" aria-label="Cerrar sesión" title="Cerrar sesión">${icono("salir")}</button>`);
document.getElementById("salir").onclick = cerrarSesion;
const busc = document.getElementById("buscador");
busc.insertAdjacentHTML("afterbegin", icono("buscar"));
busc.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("q").value.trim();
  if (q) location.hash = `#/dispositivos?q=${encodeURIComponent(q)}`;
});

export async function refrescarContadores() {
  if (!PERSONAL.includes(rol)) return;
  try {
    const p = await api.get("/api/panel");
    const poner = (ruta, n) => {
      const el = document.querySelector(`[data-cuenta="${ruta}"]`);
      if (el) { el.textContent = n; el.hidden = !n; }
    };
    poner("solicitudes", p.solicitudes_pendientes);
    poner("movimientos", p.movimientos_abiertos);
    poner("transferencias", p.transferencias_abiertas);
    const a = document.getElementById("n-alertas");
    if (a) { a.textContent = p.alertas_abiertas; a.hidden = !p.alertas_abiertas; }
  } catch { /* el panel mostrará el error */ }
}

// ------------------------------------------------------------------ rutas
async function navegar() {
  const [ruta = "panel", id] = location.hash.replace(/^#\/?/, "").split("?")[0].split("/");
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const nombre = VISTAS[ruta] ? ruta : "panel";
  const item = MENU.find((m) => m[0] === nombre);
  const vista = document.getElementById("vista");
  nav.classList.remove("abierto");
  nav.querySelectorAll(".grupo").forEach((g) => g.classList.remove("abierto"));
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("activo", a.dataset.ruta === nombre));
  nav.querySelectorAll(".grupo").forEach((g) => g.classList.toggle("activo", !!g.querySelector("a.activo")));
  if (item && !puede(item[3])) {
    vista.innerHTML = `<div class="cabecera"><div><h1>Sin permiso</h1></div></div><div class="tarjeta"><p class="muted">Su rol (${esc(usuario.nombre_rol)}) no puede ver esta sección.</p></div>`;
    return;
  }
  vista.innerHTML = cargando();
  document.title = `${item ? item[1] : "Alertas"} · EcoRAEE Cloud`;
  try {
    const mod = await VISTAS[nombre]();
    await mod.render(vista, { usuario, rol, id: id ? decodeURIComponent(id) : null, params, refrescar: navegar, refrescarContadores });
  } catch (e) {
    vista.innerHTML = `<div class="aviso error">${esc(e.message || "No se pudo cargar la vista.")}</div>`;
    mostrarError(e);
  }
  vista.focus({ preventScroll: true });
}
window.addEventListener("hashchange", navegar);
navegar();
refrescarContadores();
