import { api } from "../api.js?v=20261103b";
import { mover, subirEvidencia } from "../acciones.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { esc, estado, fmt, mostrarError, tabla, toast } from "../ui.js?v=20261103b";

export async function render(v, ctx) {
  const filtro = ctx.params.get("estado") || "";
  const puedeMover = ["COO", "ADM"].includes(ctx.rol);
  const [movs, evaluados] = await Promise.all([api.get(`/api/movimientos${filtro ? `?estado=${filtro}` : ""}`),
    puedeMover ? api.get("/api/dispositivos?estado=Evaluado") : []]);
  v.innerHTML = `<div class="cabecera"><div><h1>Movimientos entre centros</h1>
      <p>Cada traslado es atómico (RN-06) y solo se cierra con evidencia y fecha de recepción (RN-03).</p></div>
      ${puedeMover ? `<div class="acciones"><button class="btn" id="nuevo">${icono("movimiento")}Nuevo movimiento</button></div>` : ""}</div>
    <div class="chips">${["", "Abierto", "Cerrado"].map((e) => `<a class="chip ${e === filtro ? "activo" : ""}" href="#/movimientos${e ? `?estado=${e}` : ""}">${e || "Todos"}</a>`).join("")}</div>
    ${tabla(movs, [
      { t: "Movimiento", v: (m) => `<b>${esc(m.id_movimiento)}</b>` },
      { t: "Equipo", v: (m) => `<a href="#/dispositivos/${esc(m.id_dispositivo)}">${esc(m.id_dispositivo)}</a>` },
      { t: "Ruta", v: (m) => `${esc(m.origen)} → ${esc(m.destino)}` },
      { t: "Coordinador", v: (m) => esc(m.coordinador) },
      { t: "Salida", v: (m) => fmt.fechaHora(m.fecha_salida), clase: "nowrap" },
      { t: "Recepción", v: (m) => fmt.fechaHora(m.fecha_recepcion), clase: "nowrap" },
      { t: "Evidencias", v: (m) => m.n_evidencias },
      { t: "Estado", v: (m) => estado(m.estado_movimiento, m.estado_movimiento === "Cerrado" ? "verde" : "crema") }],
      { vacioTexto: "No hay movimientos.", acciones: (m) => (m.estado_movimiento === "Abierto"
        ? `<button class="btn suave chico" data-evi="${esc(m.id_movimiento)}">${icono("subir")}Evidencia</button><button class="btn chico" data-cerrar="${esc(m.id_movimiento)}" ${m.n_evidencias ? "" : 'title="Primero suba una evidencia (RN-03)"'}>${icono("check")}Confirmar llegada</button>` : "") })}`;
  v.querySelectorAll("[data-evi]").forEach((b) => b.addEventListener("click", () => subirEvidencia({ id_movimiento: b.dataset.evi }, ctx.refrescar)));
  v.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", async () => {
    try { await api.post(`/api/movimientos/${encodeURIComponent(b.dataset.cerrar)}/cerrar`); toast("Movimiento cerrado."); ctx.refrescar(); ctx.refrescarContadores(); }
    catch (e) { mostrarError(e); }
  }));
  v.querySelector("#nuevo")?.addEventListener("click", async () => {
    const enCentro = evaluados.filter((d) => d.id_centro_actual);
    const { formulario, opciones } = await import("../ui.js?v=20261103b");
    formulario({ titulo: "¿Qué equipo se mueve?", subtitulo: "Equipos evaluados que están en un centro", boton: "Continuar",
      campos: [{ n: "id", l: "Equipo", tipo: "select", req: true, opciones: opciones(enCentro, "id_dispositivo", (d) => `${d.id_dispositivo} · ${d.nombre_categoria} · ${d.nombre_centro}`) }],
      enviar: async ({ id }) => { setTimeout(() => mover(enCentro.find((d) => d.id_dispositivo === id), () => { ctx.refrescar(); ctx.refrescarContadores(); }), 0); } });
  });
}
