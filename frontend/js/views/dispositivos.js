import { api, catalogo } from "../api.js?v=20261103b";
import { asignarDestino, evaluar, mover, subirEvidencia, verEvidencia } from "../acciones.js?v=20261103b";
import { icono, iconoCategoria } from "../ilustraciones.js?v=20261103b";
import { confirmar, enlazarTabla, esc, estado, fmt, formulario, mostrarError, tabla, toast } from "../ui.js?v=20261103b";
import { CAMPOS_DISP } from "./solicitudes.js?v=20261103b";

const ESTADOS = ["Registrado", "Recolectado", "Evaluado", "Reacondicionamiento", "Asignado", "Reciclaje", "Valorizado", "Disposicion", "Cerrado"];
const RUTAS = {   // ciclo de vida (Apéndice A.4) según el destino
  base: ["Registrado", "Recolectado", "Evaluado"],
  Reacondicionamiento: ["Reacondicionamiento", "Asignado", "Cerrado"],
  Asignado: ["Reacondicionamiento", "Asignado", "Cerrado"],
  Reciclaje: ["Reciclaje", "Valorizado", "Cerrado"],
  Valorizado: ["Reciclaje", "Valorizado", "Cerrado"],
  Disposicion: ["Disposicion", "Cerrado"],
};

export async function render(v, ctx) {
  if (ctx.id) return detalle(v, ctx);
  const p = ctx.params;
  const q = new URLSearchParams();
  for (const k of ["estado", "centro", "categoria", "clasificacion", "q"]) if (p.get(k)) q.set(k, p.get(k));
  const [filas, centros, cats, clas] = await Promise.all([
    api.get(`/api/dispositivos?${q}`), catalogo("/api/centros"), catalogo("/api/catalogos/categorias"), catalogo("/api/catalogos/clasificaciones"),
  ]);
  const sel = (n, lista, val, txt, ph) => `<select data-f="${n}" aria-label="${ph}"><option value="">${ph}</option>${lista.map((x) =>
    `<option value="${esc(x[val])}" ${p.get(n) === String(x[val]) ? "selected" : ""}>${esc(x[txt])}</option>`).join("")}</select>`;
  v.innerHTML = `<div class="cabecera"><div><h1>${ctx.rol === "GEN" ? "Mis equipos" : "Dispositivos"}</h1>
      <p>${filas.length} equipos${p.get("q") ? ` que coinciden con “${esc(p.get("q"))}”` : ""}. Toque uno para ver su trazabilidad completa.</p></div>
      ${["GEN", "OPE", "ADM"].includes(ctx.rol) ? `<div class="acciones"><a class="btn" href="#/solicitudes">${icono("mas")}Registrar equipos</a></div>` : ""}</div>
    <div class="filtros">${icono("filtro")}
      ${sel("estado", ESTADOS.map((e) => ({ e })), "e", "e", "Todos los estados")}
      ${sel("categoria", cats, "id_categoria", "nombre_categoria", "Todas las categorías")}
      ${ctx.rol !== "GEN" ? sel("centro", centros, "id_centro", "nombre_centro", "Todos los centros") : ""}
      ${sel("clasificacion", clas, "nombre_clasificacion", "nombre_clasificacion", "Cualquier clasificación")}
      <input data-f="q" placeholder="Código, QR, serie…" value="${esc(p.get("q") || "")}" aria-label="Buscar">
      ${q.toString() ? '<a class="btn secundario chico" href="#/dispositivos">Limpiar</a>' : ""}</div>
    <div id="lista">${tabla(filas, [
      { t: "Equipo", v: (d) => `<b>${esc(d.id_dispositivo)}</b><div class="small muted mono">${esc(d.codigo_qr)}</div>` },
      { t: "Categoría", v: (d) => esc(d.nombre_categoria) },
      { t: "Marca y modelo", v: (d) => `${esc(d.nombre_marca)} <span class="muted">${esc(d.modelo || "")}</span>` },
      { t: "Peso", v: (d) => fmt.kg(d.peso_kg), clase: "nowrap" },
      { t: "Ubicación", v: (d) => (d.nombre_centro ? `${esc(d.nombre_centro)}<div class="small muted">${esc(d.ubicacion_centro || "")}</div>` : '<span class="muted">Fuera de centro</span>') },
      { t: "Clasificación", v: (d) => (d.clasificacion ? estado(d.clasificacion) : '<span class="muted">—</span>') },
      { t: "Estado", v: (d) => estado(d.estado_actual) },
    ], { alClic: true, vacioTexto: "No hay equipos con estos filtros." })}</div>`;
  enlazarTabla(v.querySelector("#lista"), filas, (d) => (location.hash = `#/dispositivos/${d.id_dispositivo}`));
  v.querySelectorAll("[data-f]").forEach((el) => el.addEventListener(el.tagName === "INPUT" ? "change" : "input", () => {
    const n = new URLSearchParams();
    v.querySelectorAll("[data-f]").forEach((x) => { if (x.value.trim()) n.set(x.dataset.f, x.value.trim()); });
    location.hash = `#/dispositivos${n.toString() ? `?${n}` : ""}`;
  }));
}

function pasos(estadoRuta, estadoActual = estadoRuta) {
  const ruta = [...RUTAS.base, ...(RUTAS[estadoRuta] || (estadoRuta === "Cerrado" ? [] : ["Destino", "Cerrado"]))];
  const i = ruta.indexOf(estadoActual);
  return `<div class="pasos">${ruta.map((p, j) => `<span class="paso ${j < i ? "hecho" : j === i ? "actual" : ""}">${esc(p === "Disposicion" ? "Disposición" : p)}</span>`).join("")}</div>`;
}

async function detalle(v, ctx) {
  const d = await api.get(`/api/dispositivos/${encodeURIComponent(ctx.id)}`);
  const id = d.id_dispositivo;
  const r = ctx.rol, e = d.estado_actual;
  // Si ya está cerrado, la ruta real sale del historial
  const rutaEstado = e === "Cerrado" ? (d.historial.at(-2)?.estado_nuevo || "Cerrado") : e;
  const ultimaTr = d.transferencias.at(-1);
  const b = [];
  if (e === "Registrado" && ["GEN", "OPE", "ADM"].includes(r)) b.push(`<button class="btn secundario" data-a="editar">${icono("editar")}Editar datos</button>`);
  if (d.id_centro_actual && ["OPE", "COO", "ADM"].includes(r)) b.push(`<button class="btn secundario" data-a="ubicacion">${icono("centro")}Cambiar ubicación</button>`);
  if (["Recolectado", "Evaluado"].includes(e) && r === "TEC") b.push(`<button class="btn" data-a="evaluar">${icono("evaluacion")}${e === "Evaluado" ? "Re-evaluar" : "Evaluar"}</button>`);
  if (e === "Evaluado" && d.id_centro_actual && ["COO", "ADM"].includes(r)) b.push(`<button class="btn secundario" data-a="mover">${icono("movimiento")}Mover de centro</button>`);
  const puedeAsignar = e === "Evaluado" || (e === "Reacondicionamiento" && ultimaTr?.estado_cierre === "Cerrado");
  if (puedeAsignar && ["COO", "ADM"].includes(r)) b.push(`<button class="btn" data-a="asignar">${icono("transferencia")}${e === "Evaluado" ? "Asignar destino" : "Entregar a beneficiario"}</button>`);
  if (["Asignado", "Valorizado", "Disposicion"].includes(e) && ["COO", "ADM"].includes(r)) b.push(`<button class="btn oscuro" data-a="cerrar">${icono("check")}Cerrar trazabilidad</button>`);

  v.innerHTML = `<div class="migas"><a href="#/dispositivos">${r === "GEN" ? "Mis equipos" : "Dispositivos"}</a> / ${esc(id)}</div>
    <div class="cabecera"><div><h1>${esc(id)} · ${esc(d.nombre_categoria)} ${estado(e)}</h1>
      <p>${esc(d.nombre_marca)} ${esc(d.modelo || "")} · Solicitud <a href="#/solicitudes/${esc(d.id_solicitud)}">${esc(d.id_solicitud)}</a></p></div>
      <div class="acciones">${b.join("")}</div></div>
    <div class="tarjeta">${pasos(rutaEstado, e)}${e === "Cerrado" ? '<p class="small muted" style="margin:10px 0 0">Ciclo completo: el equipo tiene destino final confirmado con evidencia (RN-08).</p>' : ""}</div>
    <div class="ficha">
      <div class="tarjeta"><div class="foto">${iconoCategoria(d.nombre_categoria)}</div>
        <dl class="datos" style="margin-top:16px">
          <div><dt>Código QR</dt><dd class="mono">${esc(d.codigo_qr)}</dd></div>
          <div><dt>Serie</dt><dd class="mono">${esc(d.numero_serie || "—")}</dd></div>
          <div><dt>Peso</dt><dd>${fmt.kg(d.peso_kg)}</dd></div>
          <div><dt>Lote</dt><dd>${esc(d.codigo_lote)}</dd></div>
          <div><dt>Centro actual</dt><dd>${esc(d.nombre_centro || "Fuera de centro")}</dd></div>
          <div><dt>Ubicación</dt><dd>${esc(d.ubicacion_centro || "—")}</dd></div>
          <div><dt>Clasificación</dt><dd>${d.clasificacion ? estado(d.clasificacion) : "Sin evaluar"}</dd></div>
          <div><dt>Registrado</dt><dd>${fmt.fecha(d.fecha_registro)}</dd></div>
        </dl></div>
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Línea de vida</h3><div class="sub">Historial de estados (entidad débil, lo llena un trigger y no se puede borrar)</div></div></div>
        <ol class="linea-vida">${d.historial.map((h) => `<li><span class="bola">${h.nro_cambio}</span>
          <div class="que">${h.estado_anterior ? `${esc(h.estado_anterior)} → ` : ""}${esc(h.estado_nuevo)}</div>
          <div class="cuando">${fmt.fechaHora(h.fecha_cambio)} · ${esc(h.responsable)} (${esc(h.nombre_rol)})</div></li>`).join("")}</ol></div>
    </div>
    <div class="grid g-2">
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Evaluaciones técnicas</h3></div></div>
        ${tabla(d.evaluaciones, [{ t: "Fecha", v: (x) => fmt.fecha(x.fecha_evaluacion), clase: "nowrap" }, { t: "Resultado", v: (x) => `${estado(x.nombre_clasificacion)} <span class="small muted">${esc(x.nombre_condicion)}</span>` },
          { t: "Diagnóstico", v: (x) => `${esc(x.diagnostico)}<div class="small muted">${esc(x.tecnico)}</div>` }], { vacioTexto: "Aún no tiene evaluaciones." })}</div>
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Movimientos entre centros</h3></div></div>
        ${tabla(d.movimientos, [{ t: "Ruta", v: (x) => `${esc(x.origen)} → ${esc(x.destino)}` }, { t: "Salida", v: (x) => fmt.fecha(x.fecha_salida), clase: "nowrap" },
          { t: "Estado", v: (x) => estado(x.estado_movimiento, x.estado_movimiento === "Cerrado" ? "verde" : "crema") }],
          { vacioTexto: "No se ha movido entre centros.", acciones: (x) => (x.estado_movimiento === "Abierto" && r !== "GEN" ? `<button class="btn suave chico" data-evi-mov="${esc(x.id_movimiento)}">${icono("subir")}Evidencia</button>` : "") })}</div>
    </div>
    <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Destinos y tratamientos</h3><div class="sub">Transferencias del equipo (RN-04 y RN-08)</div></div></div>
      ${tabla(d.transferencias, [{ t: "Transferencia", v: (x) => `<b>${esc(x.id_transferencia)}</b>` }, { t: "Destino", v: (x) => `${esc(x.nombre_entidad)}<div class="small muted">${esc(x.nombre_tipo)}</div>` },
        { t: "Tratamiento", v: (x) => (x.tipo_tratamiento ? `${esc(x.tipo_tratamiento.replace("_", " "))}<div class="small muted">${esc(x.resultado_tratamiento)}</div>` : '<span class="muted">—</span>') },
        { t: "Fecha", v: (x) => fmt.fecha(x.fecha_transferencia), clase: "nowrap" }, { t: "Cierre", v: (x) => estado(x.estado_cierre) }],
        { vacioTexto: "Todavía no tiene destino asignado.", acciones: (x) => (x.estado_cierre !== "Cerrado" && ["COO", "REA", "BEN", "ADM"].includes(r)
          ? `<a class="btn suave chico" href="#/transferencias">Gestionar</a>` : "") })}</div>
    ${d.evidencias ? `<div class="tarjeta"><div class="tarjeta-cab"><div><h3>Evidencias</h3><div class="sub">Las restringidas solo las ve coordinación (RN-07)</div></div></div>
      ${tabla(d.evidencias, [{ t: "Evidencia", v: (x) => `<b>${esc(x.id_evidencia)}</b>` }, { t: "Tipo", v: (x) => esc(x.tipo_documento) },
        { t: "Respalda", v: (x) => esc(x.id_transferencia || x.id_movimiento || x.id_evaluacion) }, { t: "Acceso", v: (x) => estado(x.nivel_acceso) },
        { t: "Fecha", v: (x) => fmt.fechaHora(x.fecha_carga) }], { vacioTexto: "Sin evidencias.", acciones: (x) => `<button class="btn suave chico" data-ver="${esc(x.id_evidencia)}">${icono("bajar")}Ver</button>` })}</div>` : ""}`;

  const recargar = () => ctx.refrescar();
  const acciones = {
    editar: async () => {
      const [cats, marcas] = await Promise.all([catalogo("/api/catalogos/categorias"), catalogo("/api/catalogos/marcas")]);
      formulario({ titulo: `Editar ${id}`, subtitulo: "Solo mientras está Registrado (antes de recolectarlo).", campos: CAMPOS_DISP(cats, marcas), valores: d,
        enviar: async (x) => { await api.put(`/api/dispositivos/${id}`, x); toast("Datos actualizados."); recargar(); } });
    },
    ubicacion: () => formulario({ titulo: "Cambiar ubicación", subtitulo: `Dentro de ${d.nombre_centro}`, campos: [{ n: "ubicacion_centro", l: "Ubicación", req: true, maxlength: 30 }],
      valores: d, enviar: async (x) => { await api.patch(`/api/dispositivos/${id}/ubicacion`, x); toast("Ubicación actualizada."); recargar(); } }),
    evaluar: () => evaluar(id, recargar),
    mover: () => mover(d, recargar),
    asignar: () => asignarDestino(d, recargar),
    cerrar: async () => {
      if (!(await confirmar("Cerrar trazabilidad", `${id} pasará a Cerrado. Requiere destino final y la última transferencia confirmada (RN-08).`, { boton: "Cerrar" }))) return;
      try { await api.post(`/api/dispositivos/${id}/cerrar`); toast("Trazabilidad cerrada."); recargar(); } catch (e) { mostrarError(e); }
    },
  };
  v.querySelectorAll("[data-a]").forEach((x) => x.addEventListener("click", () => acciones[x.dataset.a]()));
  v.querySelectorAll("[data-ver]").forEach((x) => x.addEventListener("click", () => verEvidencia(x.dataset.ver)));
  v.querySelectorAll("[data-evi-mov]").forEach((x) => x.addEventListener("click", () => subirEvidencia({ id_movimiento: x.dataset.eviMov }, recargar)));
}
