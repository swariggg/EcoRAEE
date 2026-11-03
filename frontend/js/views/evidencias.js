import { api } from "../api.js";
import { verEvidencia } from "../acciones.js";
import { icono } from "../ilustraciones.js";
import { esc, estado, fmt, tabla } from "../ui.js";

export async function render(v) {
  const filas = await api.get("/api/evidencias");
  v.innerHTML = `<div class="cabecera"><div><h1>Evidencias</h1><p>Fotos y actas que respaldan movimientos, evaluaciones y entregas. Se guarda su hash SHA-256 para detectar cambios.</p></div></div>
    <div class="aviso info">${icono("evidencia")}<span>Para subir una evidencia, abra el movimiento, la evaluación o la transferencia que respalda. En este avance los archivos quedan en <b>backend/uploads</b>; en AWS irán al bucket privado de S3. Las restringidas solo las ve coordinación (RN-07).</span></div>
    ${tabla(filas, [
      { t: "Evidencia", v: (e) => `<b>${esc(e.id_evidencia)}</b>` }, { t: "Tipo", v: (e) => esc(e.tipo_documento) },
      { t: "Equipo", v: (e) => (e.id_dispositivo ? `<a href="#/dispositivos/${esc(e.id_dispositivo)}">${esc(e.id_dispositivo)}</a>` : "—") },
      { t: "Respalda", v: (e) => esc(e.id_transferencia ? `Transferencia ${e.id_transferencia}` : e.id_movimiento ? `Movimiento ${e.id_movimiento}` : `Evaluación ${e.id_evaluacion}`) },
      { t: "Cargada por", v: (e) => `${esc(e.cargado_por)}<div class="small muted">${fmt.fechaHora(e.fecha_carga)}</div>` },
      { t: "Hash", v: (e) => `<span class="mono" title="${esc(e.hash_sha256)}">${esc(e.hash_sha256.slice(0, 12))}…</span>` },
      { t: "Acceso", v: (e) => estado(e.nivel_acceso) }],
      { vacioTexto: "No hay evidencias visibles para su rol.", acciones: (e) => (e.archivo_local ? `<button class="btn suave chico" data-ver="${esc(e.id_evidencia)}">${icono("bajar")}Ver</button>` : '<span class="small muted">Dato de ejemplo</span>') })}`;
  v.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => verEvidencia(b.dataset.ver)));
}
