// Utilidades de interfaz: escapar texto, formatos, insignias, tablas, modales con
// formularios validados, confirmaciones y notificaciones.
import { ErrorApi } from "./api.js?v=20261103b";
import { icono, VACIO } from "./ilustraciones.js?v=20261103b";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const fmt = {
  fecha: (v) => (v ? new Date(v).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }) : "—"),
  fechaHora: (v) => (v ? new Date(v).toLocaleString("es-EC", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"),
  kg: (v) => (v === null || v === undefined ? "—" : `${Number(v).toLocaleString("es-EC", { maximumFractionDigits: 2 })} kg`),
  num: (v, d = 0) => Number(v ?? 0).toLocaleString("es-EC", { maximumFractionDigits: d }),
};

// Estado -> tono de la insignia (el texto siempre acompaña al color)
const TONO = {
  Registrado: "gris", Recolectado: "azul", Evaluado: "oliva", Reacondicionamiento: "crema", Asignado: "verde",
  Reciclaje: "crema", Valorizado: "verde", Disposicion: "gris", Cerrado: "oscuro",
  Pendiente: "crema", Recibida: "verde", Cancelada: "rojo", Abierto: "crema", Cerrado_mov: "verde",
  Pendiente_Evidencia: "crema", Abierta: "rojo", Atendida: "verde", Interno: "gris", Restringido: "rojo",
  Reutilizable: "verde", Reparable: "oliva", Reciclable: "azul", "No recuperable": "gris",
};
const TEXTO = { Disposicion: "Disposición", Pendiente_Evidencia: "Pendiente de evidencia", Disposicion_controlada: "Disposición controlada" };
export function estado(valor, tono) {
  if (!valor) return '<span class="muted">—</span>';
  return `<span class="est ${tono || TONO[valor] || "gris"}">${esc(TEXTO[valor] || valor)}</span>`;
}

export function cargando(texto = "Cargando…") {
  return `<div class="cargando"><div class="spinner"></div>${esc(texto)}</div>`;
}
export function vacio(texto = "No hay registros todavía.") {
  return `<div class="vacio">${VACIO}<div>${esc(texto)}</div></div>`;
}

/**
 * Tabla: columnas = [{ t: "Título", v: (fila) => html, clase }]
 * opciones: { alClic(fila), acciones(fila) => html }
 */
export function tabla(filas, columnas, { alClic, acciones, vacioTexto } = {}) {
  if (!filas.length) return `<div class="tabla-caja">${vacio(vacioTexto)}</div>`;
  const cab = columnas.map((c) => `<th>${esc(c.t)}</th>`).join("") + (acciones ? "<th></th>" : "");
  const cuerpo = filas.map((f, i) => `<tr data-i="${i}" class="${alClic ? "clic" : ""}">${columnas
    .map((c) => `<td class="${c.clase || ""}">${c.v(f)}</td>`).join("")}${acciones ? `<td class="acc">${acciones(f)}</td>` : ""}</tr>`).join("");
  return `<div class="tabla-caja"><table class="tabla"><thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody></table></div>`;
}
export function enlazarTabla(contenedor, filas, alClic) {
  contenedor.querySelectorAll("tbody tr").forEach((tr) => {
    tr.addEventListener("click", (e) => {
      if (e.target.closest("button, a")) return;
      alClic?.(filas[Number(tr.dataset.i)]);
    });
  });
}

// ------------------------------------------------------------------ notificaciones
export function toast(mensaje, tipo = "ok") {
  let caja = document.querySelector(".toasts");
  if (!caja) { caja = document.createElement("div"); caja.className = "toasts"; caja.setAttribute("role", "status"); document.body.append(caja); }
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.innerHTML = `${icono(tipo === "error" ? "alerta" : "check")}<span>${esc(mensaje)}</span>`;
  caja.append(t);
  setTimeout(() => t.remove(), tipo === "error" ? 7000 : 3500);
}
export function mostrarError(e) {
  toast(e instanceof ErrorApi ? e.message : "Ocurrió un error inesperado.", "error");
  if (!(e instanceof ErrorApi)) console.error(e);
}

// ------------------------------------------------------------------ modal
export function modal({ titulo, subtitulo = "", cuerpo = "", ancho = false, pie = "" }) {
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `<div class="modal ${ancho ? "ancho" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-t">
    <header><div><h3 id="modal-t">${esc(titulo)}</h3>${subtitulo ? `<p>${esc(subtitulo)}</p>` : ""}</div>
      <button class="btn-icono" data-cerrar aria-label="Cerrar">${icono("cerrar")}</button></header>
    <div class="cuerpo">${cuerpo}</div>${pie ? `<footer>${pie}</footer>` : ""}</div>`;
  const cerrar = () => { fondo.remove(); document.removeEventListener("keydown", tecla); };
  const tecla = (e) => { if (e.key === "Escape") cerrar(); };
  fondo.addEventListener("mousedown", (e) => { if (e.target === fondo) cerrar(); });
  fondo.querySelector("[data-cerrar]").addEventListener("click", cerrar);
  document.addEventListener("keydown", tecla);
  document.body.append(fondo);
  return { raiz: fondo, cerrar };
}

export function confirmar(titulo, texto, { boton = "Confirmar", peligro = false } = {}) {
  return new Promise((ok) => {
    const m = modal({ titulo, cuerpo: `<p style="margin:0;color:var(--ink-2)">${esc(texto)}</p>`,
      pie: `<button class="btn secundario" data-no>Cancelar</button><button class="btn ${peligro ? "peligro" : ""}" data-si>${esc(boton)}</button>` });
    m.raiz.querySelector("[data-no]").onclick = () => { m.cerrar(); ok(false); };
    m.raiz.querySelector("[data-si]").onclick = () => { m.cerrar(); ok(true); };
  });
}

// ------------------------------------------------------------------ formularios
/**
 * campos: [{ n: "nombre", l: "Etiqueta", tipo: "text|number|select|textarea|datetime-local|file|checkbox|password|email",
 *            req, min, max, step, maxlength, minlength, patron, msgPatron, opciones: [{v, t}], ayuda, completo, valor }]
 * enviar(valores) => Promise. Si lanza ErrorApi con campos (422), se marcan en el formulario.
 */
export function formulario({ titulo, subtitulo, campos, valores = {}, boton = "Guardar", enviar, ancho = false, extra = "" }) {
  const html = `<form class="form" novalidate>${campos.map((c) => campoHtml(c, valores[c.n] ?? c.valor)).join("")}${extra}
    <div class="aviso error completo" data-error hidden style="grid-column:1/-1"></div></form>`;
  const m = modal({ titulo, subtitulo, cuerpo: html, ancho,
    pie: `<button type="button" class="btn secundario" data-cancelar>Cancelar</button><button type="button" class="btn" data-enviar>${icono("check")}${esc(boton)}</button>` });
  const form = m.raiz.querySelector("form");
  const botonEnviar = m.raiz.querySelector("[data-enviar]");
  m.raiz.querySelector("[data-cancelar]").onclick = m.cerrar;
  form.addEventListener("submit", (e) => { e.preventDefault(); botonEnviar.click(); });
  form.querySelectorAll("input, select, textarea").forEach((el) => el.addEventListener("input", () => limpiarError(el)));
  setTimeout(() => form.querySelector("input, select, textarea")?.focus(), 30);

  botonEnviar.onclick = async () => {
    const aviso = form.querySelector("[data-error]");
    aviso.hidden = true;
    if (!validar(form)) return;
    const datos = leer(form, campos);
    botonEnviar.disabled = true;
    try {
      await enviar(datos, form);
      m.cerrar();
    } catch (e) {
      if (e instanceof ErrorApi && e.campos?.length) {
        e.campos.forEach((c) => marcar(form.querySelector(`[name="${c.campo.split(".").pop()}"]`), c.mensaje));
      }
      aviso.textContent = e instanceof ErrorApi ? e.message : "Ocurrió un error inesperado.";
      aviso.hidden = false;
      if (!(e instanceof ErrorApi)) console.error(e);
    } finally {
      botonEnviar.disabled = false;
    }
  };
  return m;
}

function campoHtml(c, valor) {
  const req = c.req ? "required" : "";
  const attrs = [
    c.min !== undefined ? `min="${c.min}"` : "", c.max !== undefined ? `max="${c.max}"` : "",
    c.step ? `step="${c.step}"` : "", c.maxlength ? `maxlength="${c.maxlength}"` : "",
    c.minlength ? `minlength="${c.minlength}"` : "", c.patron ? `pattern="${c.patron}"` : "",
    c.placeholder ? `placeholder="${esc(c.placeholder)}"` : "", c.accept ? `accept="${c.accept}"` : "",
    c.msgPatron ? `data-msg-patron="${esc(c.msgPatron)}"` : "",
  ].join(" ");
  const id = `f-${c.n}`;
  const etiqueta = `<label for="${id}">${esc(c.l)}${c.req ? '<span class="req">*</span>' : ""}</label>`;
  let control;
  if (c.tipo === "select") {
    control = `<select id="${id}" name="${c.n}" ${req}><option value="">${c.req ? "Seleccione…" : "(ninguno)"}</option>${(c.opciones || [])
      .map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(valor ?? "") ? "selected" : ""}>${esc(o.t)}</option>`).join("")}</select>`;
  } else if (c.tipo === "textarea") {
    control = `<textarea id="${id}" name="${c.n}" ${req} ${attrs}>${esc(valor ?? "")}</textarea>`;
  } else if (c.tipo === "checkbox") {
    return `<div class="campo check ${c.completo ? "completo" : ""}"><input type="checkbox" id="${id}" name="${c.n}" ${valor ?? true ? "checked" : ""}>${etiqueta}</div>`;
  } else {
    control = `<input id="${id}" name="${c.n}" type="${c.tipo || "text"}" ${req} ${attrs} value="${c.tipo === "file" ? "" : esc(valor ?? "")}">`;
  }
  return `<div class="campo ${c.completo ? "completo" : ""}">${etiqueta}${control}${c.ayuda ? `<span class="ayuda">${esc(c.ayuda)}</span>` : ""}<span class="msg" aria-live="polite"></span></div>`;
}

function mensajeValidez(el) {
  const v = el.validity;
  if (v.valueMissing) return "Este campo es obligatorio.";
  if (v.typeMismatch) return el.type === "email" ? "Escriba un correo válido." : "Formato no válido.";
  if (v.patternMismatch) return el.dataset.msgPatron || "Formato no válido.";
  if (v.tooShort) return `Escriba al menos ${el.minLength} caracteres.`;
  if (v.tooLong) return `Máximo ${el.maxLength} caracteres.`;
  if (v.rangeUnderflow) return `El valor mínimo es ${el.min}.`;
  if (v.rangeOverflow) return `El valor máximo es ${el.max}.`;
  if (v.stepMismatch) return "Use como máximo 2 decimales.";
  if (v.badInput) return "Escriba un número válido.";
  return "";
}
function marcar(el, msg) {
  if (!el) return;
  const campo = el.closest(".campo");
  campo?.classList.add("error");
  const m = campo?.querySelector(".msg");
  if (m) m.textContent = msg;
  el.setAttribute("aria-invalid", "true");
}
function limpiarError(el) {
  const campo = el.closest(".campo");
  campo?.classList.remove("error");
  const m = campo?.querySelector(".msg");
  if (m) m.textContent = "";
  el.removeAttribute("aria-invalid");
}
export function validar(form) {
  let ok = true, primero = null;
  form.querySelectorAll("input, select, textarea").forEach((el) => {
    limpiarError(el);
    if (el.type !== "checkbox" && typeof el.value === "string" && el.value && el.value.trim() === "" && el.required) el.value = "";
    if (!el.checkValidity()) { ok = false; marcar(el, mensajeValidez(el)); primero ??= el; }
  });
  primero?.focus();
  return ok;
}
function leer(form, campos) {
  const datos = {};
  for (const c of campos) {
    const el = form.querySelector(`[name="${c.n}"]`);
    if (!el) continue;
    if (c.tipo === "checkbox") datos[c.n] = el.checked;
    else if (c.tipo === "file") datos[c.n] = el.files[0] || null;
    else if (c.tipo === "number") datos[c.n] = el.value === "" ? null : Number(el.value);
    else datos[c.n] = el.value.trim() === "" ? null : el.value.trim();
  }
  return datos;
}

export const opciones = (lista, v, t) => lista.map((x) => ({ v: x[v], t: typeof t === "function" ? t(x) : x[t] }));
