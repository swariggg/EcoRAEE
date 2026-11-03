import { api, catalogo } from "../api.js?v=20261103b";
import { evaluar, subirEvidencia } from "../acciones.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { esc, estado, fmt, formulario, opciones, tabla, toast } from "../ui.js?v=20261103b";

export async function render(v, ctx) {
  const esTec = ctx.rol === "TEC";
  const [evals, pendientes] = await Promise.all([api.get("/api/evaluaciones"), api.get("/api/dispositivos?estado=Recolectado")]);
  v.innerHTML = `<div class="cabecera"><div><h1>Evaluaciones técnicas</h1><p>Diagnóstico y clasificación de cada equipo (RN-02: solo técnicos activos).</p></div></div>
    <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Equipos por evaluar</h3><div class="sub">${pendientes.length} equipos recolectados esperan diagnóstico</div></div></div>
      ${tabla(pendientes, [
        { t: "Equipo", v: (d) => `<a href="#/dispositivos/${esc(d.id_dispositivo)}"><b>${esc(d.id_dispositivo)}</b></a>` },
        { t: "Categoría", v: (d) => esc(d.nombre_categoria) }, { t: "Marca y modelo", v: (d) => `${esc(d.nombre_marca)} ${esc(d.modelo || "")}` },
        { t: "Centro", v: (d) => `${esc(d.nombre_centro || "—")} <span class="small muted">${esc(d.ubicacion_centro || "")}</span>` },
        { t: "Peso", v: (d) => fmt.kg(d.peso_kg) }],
        { vacioTexto: "No hay equipos pendientes de evaluación.", acciones: (d) => (esTec ? `<button class="btn chico" data-evaluar="${esc(d.id_dispositivo)}">${icono("evaluacion")}Evaluar</button>` : "") })}</div>
    <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Evaluaciones registradas</h3><div class="sub">${evals.length} evaluaciones</div></div></div>
      ${tabla(evals, [
        { t: "Evaluación", v: (x) => `<b>${esc(x.id_evaluacion)}</b><div class="small muted">${fmt.fecha(x.fecha_evaluacion)}</div>` },
        { t: "Equipo", v: (x) => `<a href="#/dispositivos/${esc(x.id_dispositivo)}">${esc(x.id_dispositivo)}</a><div class="small muted">${esc(x.nombre_categoria)}</div>` },
        { t: "Condición", v: (x) => esc(x.nombre_condicion) }, { t: "Clasificación", v: (x) => estado(x.nombre_clasificacion) },
        { t: "Diagnóstico", v: (x) => `${esc(x.diagnostico)}<div class="small muted">${esc(x.tecnico)}</div>` },
        { t: "Equipo hoy", v: (x) => estado(x.estado_actual) }],
        { acciones: (x) => esTec ? `${x.estado_actual === "Evaluado" ? `<button class="btn suave chico" data-editar="${esc(x.id_evaluacion)}">${icono("editar")}Corregir</button>` : ""}
          <button class="btn suave chico" data-evi="${esc(x.id_evaluacion)}">${icono("subir")}Foto</button>` : "" })}</div>`;
  v.querySelectorAll("[data-evaluar]").forEach((b) => b.addEventListener("click", () => evaluar(b.dataset.evaluar, ctx.refrescar)));
  v.querySelectorAll("[data-evi]").forEach((b) => b.addEventListener("click", () => subirEvidencia({ id_evaluacion: b.dataset.evi }, ctx.refrescar)));
  v.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", async () => {
    const ev = evals.find((x) => x.id_evaluacion === b.dataset.editar);
    const [conds, clas] = await Promise.all([catalogo("/api/catalogos/condiciones"), catalogo("/api/catalogos/clasificaciones")]);
    formulario({ titulo: `Corregir ${ev.id_evaluacion}`, subtitulo: `Equipo ${ev.id_dispositivo}. Solo antes de asignarle destino.`, valores: ev,
      campos: [{ n: "id_condicion", l: "Condición", tipo: "select", req: true, opciones: opciones(conds, "id_condicion", "nombre_condicion") },
        { n: "id_clasificacion", l: "Clasificación", tipo: "select", req: true, opciones: opciones(clas, "id_clasificacion", "nombre_clasificacion") },
        { n: "diagnostico", l: "Diagnóstico", tipo: "textarea", req: true, minlength: 10, maxlength: 500, completo: true }],
      enviar: async (d) => { await api.put(`/api/evaluaciones/${ev.id_evaluacion}`, d); toast("Evaluación corregida."); ctx.refrescar(); } });
  }));
}
