import { api } from "../api.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { esc, estado, fmt, mostrarError, tabla, toast } from "../ui.js?v=20261103b";

export async function render(v, ctx) {
  const filas = await api.get("/api/alertas");
  const puede = ["OPE", "COO", "ADM"].includes(ctx.rol);
  v.innerHTML = `<div class="cabecera"><div><h1>Alertas de capacidad</h1><p>El trigger tr_centro_alerta crea una alerta cuando un centro llega al 90 % de su capacidad.</p></div></div>
    ${tabla(filas, [{ t: "Centro", v: (f) => `<a href="#/centros/${esc(f.id_centro)}">${esc(f.nombre_centro)}</a>` }, { t: "Mensaje", v: (f) => esc(f.mensaje) },
      { t: "Fecha", v: (f) => fmt.fechaHora(f.fecha), clase: "nowrap" }, { t: "Estado", v: (f) => estado(f.estado_alerta) }],
      { vacioTexto: "No hay alertas.", acciones: (f) => (puede && f.estado_alerta === "Abierta" ? `<button class="btn suave chico" data-atender="${f.id_alerta}">${icono("check")}Atendida</button>` : "") })}`;
  v.querySelectorAll("[data-atender]").forEach((b) => b.addEventListener("click", async () => {
    try { await api.post(`/api/alertas/${b.dataset.atender}/atender`); toast("Alerta atendida."); ctx.refrescar(); ctx.refrescarContadores(); } catch (e) { mostrarError(e); }
  }));
}
