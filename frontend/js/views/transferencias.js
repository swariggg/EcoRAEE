import { api } from "../api.js?v=20261103b";
import { asignarDestino, subirEvidencia } from "../acciones.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { esc, estado, fmt, formulario, mostrarError, opciones, tabla, toast } from "../ui.js?v=20261103b";

const TIPO_TRAT = { Reacondicionamiento: "Reacondicionamiento", Reciclaje: "Reciclaje", Disposicion: "Disposicion_controlada" };

export async function render(v, ctx) {
  const r = ctx.rol;
  const filtro = ctx.params.get("estado") || "";
  const coord = ["COO", "ADM"].includes(r);
  const [trs, listos] = await Promise.all([api.get(`/api/transferencias${filtro ? `?estado=${filtro}` : ""}`),
    coord ? api.get("/api/dispositivos?estado=Evaluado") : []]);
  v.innerHTML = `<div class="cabecera"><div><h1>${r === "REA" || r === "BEN" ? "Equipos enviados a su organización" : "Destinos asignados"}</h1>
      <p>Transferencia al destino → tratamiento → evidencia de entrega → confirmación (RN-04, RN-08).</p></div>
      ${coord ? `<div class="acciones"><button class="btn" id="nueva">${icono("transferencia")}Asignar destino</button></div>` : ""}</div>
    <div class="chips">${[["", "Todas"], ["Pendiente_Evidencia", "Pendientes"], ["Cerrado", "Cerradas"]].map(([e, t]) =>
      `<a class="chip ${e === filtro ? "activo" : ""}" href="#/transferencias${e ? `?estado=${e}` : ""}">${t}</a>`).join("")}</div>
    ${tabla(trs, [
      { t: "Transferencia", v: (t) => `<b>${esc(t.id_transferencia)}</b><div class="small muted">${fmt.fecha(t.fecha_transferencia)}</div>` },
      { t: "Equipo", v: (t) => `<a href="#/dispositivos/${esc(t.id_dispositivo)}">${esc(t.id_dispositivo)}</a><div class="small muted">${esc(t.nombre_categoria)}</div>` },
      { t: "Destino", v: (t) => `${esc(t.nombre_entidad)}<div class="small muted">${esc(t.tipo_destino)}</div>` },
      { t: "Tratamiento", v: (t) => (t.tipo_tratamiento ? `${esc(t.tipo_tratamiento.replace("_", " "))}<div class="small muted">${esc(t.resultado_tratamiento)}</div>` : '<span class="muted">—</span>') },
      { t: "Evid.", v: (t) => t.n_evidencias },
      { t: "Equipo hoy", v: (t) => estado(t.estado_actual) },
      { t: "Cierre", v: (t) => estado(t.estado_cierre) }],
      { vacioTexto: "No hay transferencias.", acciones: (t) => {
        if (t.estado_cierre === "Cerrado") return "";
        const b = [`<button class="btn suave chico" data-evi="${esc(t.id_transferencia)}">${icono("subir")}Evidencia</button>`];
        const tipo = TIPO_TRAT[t.estado_actual];
        if (!t.id_tratamiento && tipo && ["REA", "ADM"].includes(r) && t.tipo_destino !== "Beneficiario") b.push(`<button class="btn secundario chico" data-trat="${esc(t.id_transferencia)}">Tratamiento</button>`);
        if (["COO", "REA", "BEN", "ADM"].includes(r)) b.push(`<button class="btn chico" data-conf="${esc(t.id_transferencia)}">${icono("check")}Confirmar recepción</button>`);
        return b.join("");
      } })}`;
  v.querySelectorAll("[data-evi]").forEach((b) => b.addEventListener("click", () => subirEvidencia({ id_transferencia: b.dataset.evi }, ctx.refrescar)));
  v.querySelectorAll("[data-conf]").forEach((b) => b.addEventListener("click", async () => {
    try { await api.post(`/api/transferencias/${encodeURIComponent(b.dataset.conf)}/confirmar`); toast("Recepción confirmada."); ctx.refrescar(); ctx.refrescarContadores(); }
    catch (e) { mostrarError(e); }
  }));
  v.querySelectorAll("[data-trat]").forEach((b) => b.addEventListener("click", () => {
    const t = trs.find((x) => x.id_transferencia === b.dataset.trat);
    const tipo = TIPO_TRAT[t.estado_actual];
    formulario({ titulo: "Registrar tratamiento", subtitulo: `${t.id_dispositivo} en ${t.nombre_entidad}. ${tipo === "Reciclaje" ? "El equipo pasará a Valorizado." : ""}`, boton: "Registrar",
      campos: [{ n: "tipo_tratamiento", l: "Tipo", tipo: "select", req: true, valor: tipo, opciones: [{ v: tipo, t: tipo.replace("_", " ") }] },
        { n: "resultado", l: "Resultado", tipo: "textarea", req: true, minlength: 5, maxlength: 300, completo: true, placeholder: "Qué se hizo con el equipo" }],
      enviar: async (d) => { await api.post("/api/tratamientos", { ...d, id_transferencia: t.id_transferencia }); toast("Tratamiento registrado."); ctx.refrescar(); } });
  }));
  v.querySelector("#nueva")?.addEventListener("click", async () => {
    const reac = (await api.get("/api/dispositivos?estado=Reacondicionamiento")).filter((d) =>
      trs.some((t) => t.id_dispositivo === d.id_dispositivo && t.estado_cierre === "Cerrado") && !trs.some((t) => t.id_dispositivo === d.id_dispositivo && t.estado_cierre !== "Cerrado"));
    const lista = [...listos, ...reac];
    formulario({ titulo: "¿A qué equipo se le asigna destino?", subtitulo: "Equipos evaluados o ya reacondicionados", boton: "Continuar",
      campos: [{ n: "id", l: "Equipo", tipo: "select", req: true, opciones: opciones(lista, "id_dispositivo", (d) => `${d.id_dispositivo} · ${d.nombre_categoria} · ${d.clasificacion || ""} · ${d.estado_actual}`) }],
      enviar: async ({ id }) => { setTimeout(() => asignarDestino(lista.find((d) => d.id_dispositivo === id), () => { ctx.refrescar(); ctx.refrescarContadores(); }), 0); } });
  });
}
