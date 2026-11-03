import { api, catalogo } from "../api.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { confirmar, enlazarTabla, esc, estado, fmt, formulario, mostrarError, opciones, tabla, toast, validar } from "../ui.js?v=20261103b";

const CAMPOS_DISP = (cats, marcas) => [
  { n: "id_categoria", l: "Categoría", tipo: "select", req: true, opciones: opciones(cats, "id_categoria", "nombre_categoria") },
  { n: "id_marca", l: "Marca", tipo: "select", req: true, opciones: opciones(marcas, "id_marca", "nombre_marca") },
  { n: "numero_serie", l: "Número de serie", maxlength: 100, patron: "[A-Za-z0-9\\-_/\\.]*", msgPatron: "Solo letras, números, - _ / .", ayuda: "Opcional. No se puede repetir." },
  { n: "modelo", l: "Modelo", maxlength: 100 },
  { n: "peso_kg", l: "Peso (kg)", tipo: "number", req: true, min: 0.01, max: 500, step: 0.01, ayuda: "Se usa en el modelo de flujo (kg)." },
];

export async function render(v, ctx) {
  if (ctx.id) return detalle(v, ctx);
  const filtro = ctx.params.get("estado") || "";
  const filas = await api.get(`/api/solicitudes${filtro ? `?estado=${filtro}` : ""}`);
  const puedeCrear = ["GEN", "OPE", "ADM"].includes(ctx.rol);
  v.innerHTML = `<div class="cabecera"><div><h1>Solicitudes de entrega</h1>
      <p>${ctx.rol === "GEN" ? "Sus entregas de equipos en desuso." : "Entregas de equipos que llegan a los centros de acopio."}</p></div>
      <div class="acciones">${puedeCrear ? `<button class="btn" id="nueva">${icono("mas")}Nueva solicitud</button>` : ""}</div></div>
    <div class="chips">${["", "Pendiente", "Recibida", "Cancelada"].map((e) =>
      `<a class="chip ${e === filtro ? "activo" : ""}" href="#/solicitudes${e ? `?estado=${e}` : ""}">${e || "Todas"}</a>`).join("")}</div>
    <div id="lista">${tabla(filas, [
      { t: "Solicitud", v: (f) => `<b>${esc(f.id_solicitud)}</b>` },
      { t: "Generador", v: (f) => `${esc(f.generador)}<div class="small muted">${esc(f.organizacion)}</div>` },
      { t: "Centro", v: (f) => esc(f.nombre_centro) },
      { t: "Equipos", v: (f) => `${f.n_dispositivos} <span class="muted small">· ${fmt.kg(f.peso_total_kg)}</span>`, clase: "nowrap" },
      { t: "Recolección", v: (f) => (f.fecha_realizada ? `Realizada ${fmt.fecha(f.fecha_realizada)}` : f.fecha_programada ? `Programada ${fmt.fecha(f.fecha_programada)}` : '<span class="muted">Sin programar</span>') },
      { t: "Fecha", v: (f) => fmt.fecha(f.fecha_solicitud), clase: "nowrap" },
      { t: "Estado", v: (f) => estado(f.estado_solicitud) },
    ], { alClic: true, vacioTexto: "No hay solicitudes con este filtro." })}</div>`;
  enlazarTabla(v.querySelector("#lista"), filas, (f) => (location.hash = `#/solicitudes/${f.id_solicitud}`));
  v.querySelector("#nueva")?.addEventListener("click", () => nueva(ctx));
}

async function nueva(ctx) {
  const [centros, cats, marcas, gens] = await Promise.all([
    catalogo("/api/centros"), catalogo("/api/catalogos/categorias"), catalogo("/api/catalogos/marcas"),
    ctx.rol === "GEN" ? [] : api.get("/api/usuarios?rol=GEN"),
  ]);
  const filaHtml = () => `<div class="fila-disp">
      <div class="campo"><select name="id_categoria" required aria-label="Categoría"><option value="">Categoría…</option>${cats.map((c) => `<option value="${esc(c.id_categoria)}">${esc(c.nombre_categoria)}</option>`).join("")}</select><span class="msg"></span></div>
      <div class="campo"><select name="id_marca" required aria-label="Marca"><option value="">Marca…</option>${marcas.map((c) => `<option value="${esc(c.id_marca)}">${esc(c.nombre_marca)}</option>`).join("")}</select><span class="msg"></span></div>
      <div class="campo"><input name="numero_serie" maxlength="100" pattern="[A-Za-z0-9\\-_/\\.]*" data-msg-patron="Solo letras, números, - _ / ." placeholder="N.º de serie" aria-label="Número de serie"><span class="msg"></span></div>
      <div class="campo"><input name="modelo" maxlength="100" placeholder="Modelo" aria-label="Modelo"><span class="msg"></span></div>
      <div class="campo"><input name="peso_kg" type="number" min="0.01" max="500" step="0.01" required placeholder="kg" aria-label="Peso en kg"><span class="msg"></span></div>
      <button type="button" class="btn-icono" data-quitar aria-label="Quitar equipo">${icono("borrar")}</button></div>`;
  const campos = [
    { n: "id_centro_destino", l: "Centro de acopio", tipo: "select", req: true, opciones: opciones(centros, "id_centro", (c) => `${c.nombre_centro} (${c.capacidad_unidades - c.ocupacion_actual_unidades} libres)`) },
  ];
  if (ctx.rol !== "GEN") campos.push({ n: "id_usuario_generador", l: "Generador", tipo: "select", req: true, opciones: opciones(gens, "id_usuario", (u) => `${u.nombres} ${u.apellidos}`) });
  const m = formulario({
    titulo: "Nueva solicitud de entrega", subtitulo: "Se crea con un lote y los equipos que agregue. Todos empiezan en estado Registrado (RN-01).",
    ancho: true, campos, boton: "Registrar solicitud",
    extra: `<div class="campo completo"><label>Equipos a entregar</label><div class="filas-disp" id="filas">${filaHtml()}</div>
      <button type="button" class="btn suave chico" id="otra" style="justify-self:start;margin-top:4px">${icono("mas")}Agregar otro equipo</button></div>`,
    enviar: async (datos, form) => {
      const filas = [...form.querySelectorAll(".fila-disp")];
      if (!filas.length) throw new Error("Agregue al menos un equipo.");
      const dispositivos = filas.map((f) => ({
        id_categoria: f.querySelector("[name=id_categoria]").value, id_marca: f.querySelector("[name=id_marca]").value,
        numero_serie: f.querySelector("[name=numero_serie]").value.trim() || null, modelo: f.querySelector("[name=modelo]").value.trim() || null,
        peso_kg: Number(f.querySelector("[name=peso_kg]").value),
      }));
      const r = await api.post("/api/solicitudes", { ...datos, dispositivos });
      toast(`Solicitud ${r.id_solicitud} registrada con ${r.n_dispositivos} equipos.`);
      location.hash = `#/solicitudes/${r.id_solicitud}`;
      ctx.refrescarContadores();
    },
  });
  const filas = m.raiz.querySelector("#filas");
  m.raiz.querySelector("#otra").onclick = () => filas.insertAdjacentHTML("beforeend", filaHtml());
  filas.addEventListener("click", (e) => {
    if (e.target.closest("[data-quitar]") && filas.children.length > 1) e.target.closest(".fila-disp").remove();
  });
}

async function detalle(v, ctx) {
  const s = await api.get(`/api/solicitudes/${encodeURIComponent(ctx.id)}`);
  const pendiente = s.estado_solicitud === "Pendiente";
  const dueno = ["ADM", "OPE"].includes(ctx.rol) || s.id_usuario_generador === ctx.usuario.id_usuario;
  const b = [];
  if (pendiente && dueno) {
    b.push(`<button class="btn secundario" data-a="agregar">${icono("mas")}Agregar equipo</button>`);
    b.push(`<button class="btn secundario" data-a="editar">${icono("editar")}Cambiar centro</button>`);
  }
  if (pendiente && ["OPE", "COO", "ADM"].includes(ctx.rol)) b.push(`<button class="btn secundario" data-a="recoleccion">${icono("movimiento")}${s.fecha_programada ? "Reprogramar" : "Programar"} recolección</button>`);
  if (pendiente && ["OPE", "ADM"].includes(ctx.rol)) b.push(`<button class="btn" data-a="recibir">${icono("check")}Recibir en el centro</button>`);
  if (pendiente && dueno) b.push(`<button class="btn peligro" data-a="cancelar">${icono("borrar")}Cancelar solicitud</button>`);

  v.innerHTML = `<div class="migas"><a href="#/solicitudes">Solicitudes</a> / ${esc(s.id_solicitud)}</div>
    <div class="cabecera"><div><h1>Solicitud ${esc(s.id_solicitud)} ${estado(s.estado_solicitud)}</h1>
      <p>${esc(s.generador)} · ${esc(s.organizacion)} · ${fmt.fecha(s.fecha_solicitud)}</p></div><div class="acciones">${b.join("")}</div></div>
    <div class="grid g-4">
      <div class="kpi t1"><span class="et">Centro de acopio</span><span class="val" style="font-size:20px">${esc(s.nombre_centro)}</span></div>
      <div class="kpi t2"><span class="et">Equipos</span><span class="val">${s.n_dispositivos}</span></div>
      <div class="kpi t3"><span class="et">Peso total</span><span class="val">${fmt.num(s.peso_total_kg, 2)}<small>kg</small></span></div>
      <div class="kpi t4"><span class="et">Recolección</span><span class="val" style="font-size:18px">${s.fecha_realizada ? `Realizada ${fmt.fecha(s.fecha_realizada)}` : s.fecha_programada ? `Programada ${fmt.fechaHora(s.fecha_programada)}` : "Sin programar"}</span></div>
    </div>
    ${s.recepcion ? `<div class="aviso info">${icono("check")}<span>Recibida el ${fmt.fechaHora(s.recepcion.fecha_recepcion)} por ${esc(s.recepcion.operador)}: ${s.recepcion.cantidad_recibida} equipos.</span></div>` : ""}
    <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Lotes</h3><div class="sub">Una entrega puede llegar en uno o varios lotes</div></div>
      ${pendiente && dueno ? `<button class="btn suave chico" data-a="lote">${icono("mas")}Nuevo lote</button>` : ""}</div>
      ${tabla(s.lotes, [{ t: "Lote", v: (l) => `<b>${esc(l.codigo_lote)}</b> <span class="muted small">${esc(l.id_lote)}</span>` },
        { t: "Creado", v: (l) => fmt.fechaHora(l.fecha_creacion) }, { t: "Equipos", v: (l) => l.n_dispositivos }],
        { acciones: (l) => (pendiente && dueno && !l.n_dispositivos ? `<button class="btn peligro chico" data-borrar-lote="${esc(l.id_lote)}">Eliminar</button>` : "") })}</div>
    <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Equipos de la solicitud</h3><div class="sub">Toque un equipo para ver su trazabilidad</div></div></div>
      <div id="equipos">${tabla(s.dispositivos, [
        { t: "Equipo", v: (d) => `<b>${esc(d.id_dispositivo)}</b><div class="small muted mono">${esc(d.codigo_qr)}</div>` },
        { t: "Categoría", v: (d) => esc(d.nombre_categoria) }, { t: "Marca y modelo", v: (d) => `${esc(d.nombre_marca)} ${esc(d.modelo || "")}` },
        { t: "Serie", v: (d) => `<span class="mono">${esc(d.numero_serie || "—")}</span>` }, { t: "Lote", v: (d) => esc(d.id_lote) },
        { t: "Peso", v: (d) => fmt.kg(d.peso_kg), clase: "nowrap" }, { t: "Estado", v: (d) => estado(d.estado_actual) }],
        { alClic: true, vacioTexto: "Todavía no hay equipos en esta solicitud." })}</div></div>`;
  enlazarTabla(v.querySelector("#equipos"), s.dispositivos, (d) => (location.hash = `#/dispositivos/${d.id_dispositivo}`));

  const id = encodeURIComponent(s.id_solicitud);
  const acciones = {
    agregar: async () => {
      const [cats, marcas] = await Promise.all([catalogo("/api/catalogos/categorias"), catalogo("/api/catalogos/marcas")]);
      const campos = [...CAMPOS_DISP(cats, marcas), { n: "id_lote", l: "Lote", tipo: "select", opciones: opciones(s.lotes, "id_lote", "codigo_lote"), ayuda: "Vacío = último lote" }];
      formulario({ titulo: "Agregar equipo", subtitulo: `A la solicitud ${s.id_solicitud}`, campos, boton: "Agregar",
        enviar: async (d) => {
          const lote = d.id_lote; delete d.id_lote;
          const r = await api.post(`/api/solicitudes/${id}/dispositivos${lote ? `?id_lote=${encodeURIComponent(lote)}` : ""}`, d);
          toast(`Equipo ${r.id_dispositivo} registrado.`); ctx.refrescar();
        } });
    },
    editar: async () => {
      const centros = await catalogo("/api/centros");
      formulario({ titulo: "Cambiar centro de acopio", campos: [{ n: "id_centro_destino", l: "Centro", tipo: "select", req: true, opciones: opciones(centros, "id_centro", "nombre_centro") }],
        valores: s, enviar: async (d) => { await api.put(`/api/solicitudes/${id}`, d); toast("Solicitud actualizada."); ctx.refrescar(); } });
    },
    recoleccion: async () => {
      const ops = await api.get("/api/usuarios?rol=OPE");
      const manana = new Date(Date.now() + 864e5); manana.setHours(9, 0, 0, 0);
      const local = (dt) => new Date(dt.getTime() - dt.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
      formulario({ titulo: "Programar recolección", subtitulo: "El operador pasará a recoger los equipos", boton: "Programar",
        campos: [{ n: "id_usuario_operador", l: "Operador responsable", tipo: "select", req: true, opciones: opciones(ops, "id_usuario", (u) => `${u.nombres} ${u.apellidos}`) },
          { n: "fecha_programada", l: "Fecha y hora", tipo: "datetime-local", req: true, min: local(new Date()) }],
        valores: { id_usuario_operador: s.operador_recoleccion, fecha_programada: s.fecha_programada ? s.fecha_programada.slice(0, 16) : local(manana) },
        enviar: async (d) => { await api.put(`/api/solicitudes/${id}/recoleccion`, d); toast("Recolección programada."); ctx.refrescar(); } });
    },
    recibir: () => formulario({ titulo: "Recibir solicitud en el centro", subtitulo: `Todos los equipos pasan a Recolectado y ocupan espacio en ${s.nombre_centro}. Si no hay espacio, no se guarda nada (RN-06).`,
      boton: "Recibir", campos: [{ n: "ubicacion", l: "Ubicación dentro del centro", req: true, maxlength: 30, placeholder: "Estante A" }],
      enviar: async (d) => { await api.post(`/api/solicitudes/${id}/recibir`, d); toast("Solicitud recibida."); ctx.refrescar(); ctx.refrescarContadores(); } }),
    cancelar: async () => {
      if (!(await confirmar("Cancelar solicitud", "La solicitud quedará como Cancelada. Sus equipos se conservan en el historial.", { boton: "Cancelar solicitud", peligro: true }))) return;
      try { await api.del(`/api/solicitudes/${id}`); toast("Solicitud cancelada."); ctx.refrescar(); ctx.refrescarContadores(); } catch (e) { mostrarError(e); }
    },
    lote: async () => {
      try { const l = await api.post(`/api/solicitudes/${id}/lotes`); toast(`Lote ${l.codigo_lote} creado.`); ctx.refrescar(); } catch (e) { mostrarError(e); }
    },
  };
  v.querySelectorAll("[data-a]").forEach((btn) => btn.addEventListener("click", () => acciones[btn.dataset.a]()));
  v.querySelectorAll("[data-borrar-lote]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!(await confirmar("Eliminar lote", `¿Eliminar el lote ${btn.dataset.borrarLote}? Solo se puede si no tiene equipos.`, { boton: "Eliminar", peligro: true }))) return;
    try { await api.del(`/api/solicitudes/${id}/lotes/${encodeURIComponent(btn.dataset.borrarLote)}`); toast("Lote eliminado."); ctx.refrescar(); } catch (e) { mostrarError(e); }
  }));
}

export { CAMPOS_DISP };
