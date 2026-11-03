import { api } from "../api.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { confirmar, esc, fmt, formulario, mostrarError, tabla, toast } from "../ui.js?v=20261103b";

// Capas por camino más largo desde la fuente (la red es un DAG): fuente a la izquierda, sumidero a la derecha.
function capas(aristas, fuente, sumidero) {
  const nodos = new Set([fuente, sumidero]);
  aristas.forEach((a) => { nodos.add(a.id_nodo_origen); nodos.add(a.id_nodo_destino); });
  const capa = Object.fromEntries([...nodos].map((n) => [n, 0]));
  for (let k = 0; k < nodos.size; k++) {
    let cambio = false;
    for (const a of aristas) if (a.id_nodo_destino !== fuente && capa[a.id_nodo_destino] < capa[a.id_nodo_origen] + 1) { capa[a.id_nodo_destino] = capa[a.id_nodo_origen] + 1; cambio = true; }
    if (!cambio) break;
  }
  capa[sumidero] = Math.max(...Object.values(capa));
  return capa;
}

function dibujar(esc_, nodosInfo) {
  const ar = esc_.aristas;
  const res = new Map((esc_.resultado?.aristas || []).map((r) => [r.nro_arista, r]));
  const capa = capas(ar, esc_.id_nodo_fuente, esc_.id_nodo_sumidero);
  const porCapa = {};
  Object.entries(capa).forEach(([n, c]) => (porCapa[c] ||= []).push(n));
  const nCapas = Math.max(...Object.keys(porCapa).map(Number)) + 1;
  const W = 1000, H = Math.max(360, 110 * Math.max(...Object.values(porCapa).map((l) => l.length)) + 40), bw = 132, bh = 46;
  const pos = {};
  Object.entries(porCapa).forEach(([c, lista]) => {
    lista.sort();
    lista.forEach((n, i) => { pos[n] = { x: 20 + (Number(c) * (W - 40 - bw)) / Math.max(1, nCapas - 1), y: ((i + 1) * H) / (lista.length + 1) - bh / 2 }; });
  });
  const maxCap = Math.max(...ar.map((a) => Number(a.capacidad_kg)));
  const aristasSvg = ar.map((a) => {
    const p = pos[a.id_nodo_origen], q = pos[a.id_nodo_destino];
    const x1 = p.x + bw, y1 = p.y + bh / 2, x2 = q.x, y2 = q.y + bh / 2;
    const dx = Math.max(40, (x2 - x1) / 2);
    const r = res.get(a.nro_arista);
    const flujo = r ? Number(r.flujo_kg) : null;
    const clase = r?.en_corte_minimo ? "corte" : flujo > 0 ? "flujo" : "";
    const ancho = 1.5 + (6 * (flujo ?? Number(a.capacidad_kg) * 0.3)) / maxCap;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const etiqueta = r ? `${fmt.num(flujo, 1)}/${fmt.num(a.capacidad_kg, 1)}` : fmt.num(a.capacidad_kg, 1);
    return `<g class="arista ${clase}"><title>${esc(a.nombre_origen)} → ${esc(a.nombre_destino)}: ${r ? `flujo ${flujo} de ` : ""}capacidad ${a.capacidad_kg} kg${r?.en_corte_minimo ? " · corte mínimo" : ""}</title>
      <path d="M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}" stroke-width="${ancho.toFixed(1)}" marker-end="url(#flecha${clase ? "-" + clase : ""})"/>
      <text x="${mx}" y="${my - 6}" text-anchor="middle">${etiqueta}</text></g>`;
  }).join("");
  const nodosSvg = Object.entries(pos).map(([n, p]) => {
    const info = nodosInfo.find((x) => x.id_nodo === n) || { nombre_nodo: n, tipo_nodo: "" };
    const corto = info.nombre_nodo.length > 20 ? `${info.nombre_nodo.slice(0, 19)}…` : info.nombre_nodo;
    return `<g class="nodo ${info.tipo_nodo}"><title>${esc(info.nombre_nodo)}</title><rect x="${p.x}" y="${p.y}" width="${bw}" height="${bh}" rx="14"/>
      <text x="${p.x + bw / 2}" y="${p.y + 20}" text-anchor="middle">${esc(n.replace("N-", ""))}</text>
      <text class="sub" x="${p.x + bw / 2}" y="${p.y + 35}" text-anchor="middle">${esc(corto)}</text></g>`;
  }).join("");
  const marcador = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`;
  return `<svg class="red-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Red de flujo del escenario ${esc(esc_.id_escenario)}">
    <defs>${marcador("flecha", "#B6C99B")}${marcador("flecha-flujo", "#728156")}${marcador("flecha-corte", "#A8432F")}</defs>${aristasSvg}${nodosSvg}</svg>`;
}

export async function render(v, ctx) {
  const [escs, nodos, oferta] = await Promise.all([api.get("/api/red/escenarios"), api.get("/api/red/nodos"), api.get("/api/red/oferta")]);
  const id = ctx.id || escs[0]?.id_escenario;
  const e = id ? await api.get(`/api/red/escenarios/${encodeURIComponent(id)}`) : null;
  const coord = ["COO", "ADM"].includes(ctx.rol);
  const flujo = e?.resultado ? Number(e.resultado.flujo_maximo_kg) : null;
  const corte = e?.resultado?.aristas.filter((a) => a.en_corte_minimo) || [];
  v.innerHTML = `<div class="cabecera"><div><h1>Red logística y flujo máximo</h1>
      <p>Edmonds-Karp con los datos de la base: cuántos kg por ${esc(e?.periodo || "semana")} pueden llegar a los destinos y dónde está el cuello de botella.</p></div>
      ${coord ? `<div class="acciones"><button class="btn secundario" id="nuevo">${icono("mas")}Nuevo escenario</button></div>` : ""}</div>
    <div class="chips">${escs.map((x) => `<a class="chip ${x.id_escenario === id ? "activo" : ""}" href="#/red/${esc(x.id_escenario)}">${esc(x.id_escenario)} · ${esc(x.nombre_escenario)}${x.flujo_maximo_kg !== null ? ` · ${fmt.num(x.flujo_maximo_kg)} kg` : ""}</a>`).join("")}</div>
    ${e ? `
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>${esc(e.nombre_escenario)}</h3><div class="sub">${esc(e.descripcion || "")}</div></div>
        <div class="acciones">${coord ? `<button class="btn secundario chico" id="editar">${icono("editar")}Editar</button><button class="btn peligro chico" id="borrar">${icono("borrar")}</button><button class="btn" id="ejecutar">${icono("play")}Ejecutar algoritmo</button>` : ""}</div></div>
        ${dibujar(e, nodos)}
        <div class="leyenda" style="margin-top:10px"><span><i></i>Lleva flujo</span><span><i class="corte"></i>Corte mínimo (cuello de botella)</span><span><i class="vacia"></i>Sin flujo</span><span>Etiqueta: flujo / capacidad (kg)</span></div></div>
      <div class="grid g-3" style="align-items:start">
        <div class="tarjeta suave"><div class="sub">Flujo máximo${e.resultado ? ` · ejecución ${e.resultado.nro_ejecucion}` : ""}</div>
          <div class="grande" style="margin:8px 0">${flujo !== null ? `${fmt.num(flujo, 1)} <span style="font-size:18px">kg</span>` : "—"}</div>
          <div class="sub">${flujo !== null ? `Capacidad del corte mínimo: ${fmt.num(corte.reduce((s, a) => s + Number(a.capacidad_kg), 0), 1)} kg (igual al flujo, teorema de flujo máximo y corte mínimo).` : "Aún no se ha ejecutado."}</div></div>
        <div class="tarjeta"><h3>Corte mínimo</h3><div class="sub" style="margin-bottom:10px">Si se amplía una de estas aristas, puede crecer el flujo</div>
          ${corte.length ? `<ul style="margin:0;padding-left:18px">${corte.map((a) => `<li><b>${esc(a.nombre_origen)}</b> → <b>${esc(a.nombre_destino)}</b>: ${fmt.kg(a.capacidad_kg)}</li>`).join("")}</ul>` : '<span class="muted">—</span>'}</div>
        <div class="tarjeta"><h3>Oferta real en los centros</h3><div class="sub" style="margin-bottom:10px">Kg evaluados que esperan destino (vista vw_oferta_kg_centro)</div>
          ${oferta.map((o) => `<div class="barra-fila" style="grid-template-columns:1fr auto"><span>${esc(o.nombre_centro)}</span><span class="num">${fmt.kg(o.kg_pendientes)}</span></div>`).join("")}</div>
      </div>
      <div class="tarjeta" id="caminos" hidden></div>
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Aristas del escenario</h3><div class="sub">${e.aristas.length} aristas · ${e.ejecuciones.length} ejecuciones guardadas</div></div></div>
        ${tabla(e.aristas.map((a) => ({ ...a, r: e.resultado?.aristas.find((x) => x.nro_arista === a.nro_arista) })), [
          { t: "N.º", v: (a) => a.nro_arista }, { t: "Desde", v: (a) => esc(a.nombre_origen) }, { t: "Hacia", v: (a) => esc(a.nombre_destino) },
          { t: "Capacidad", v: (a) => fmt.kg(a.capacidad_kg), clase: "nowrap" }, { t: "Flujo", v: (a) => (a.r ? fmt.kg(a.r.flujo_kg) : "—"), clase: "nowrap" },
          { t: "Uso", v: (a) => (a.r ? `${fmt.num(a.r.uso_pct, 1)} %` : "—") },
          { t: "", v: (a) => (a.r?.en_corte_minimo ? '<span class="est rojo">Corte mínimo</span>' : a.r?.saturada ? '<span class="est crema">Saturada</span>' : "") }])}</div>`
    : '<div class="tarjeta">No hay escenarios.</div>'}`;

  v.querySelector("#ejecutar")?.addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    try {
      const r = await api.post(`/api/red/escenarios/${encodeURIComponent(id)}/ejecutar`);
      toast(`Flujo máximo: ${fmt.num(r.resultado.flujo_maximo_kg, 1)} kg (ejecución ${r.resultado.nro_ejecucion} guardada).`);
      await render(v, ctx);
      const c = v.querySelector("#caminos");
      c.hidden = false;
      c.innerHTML = `<h3>Caminos de aumento encontrados (BFS)</h3><div class="sub" style="margin-bottom:10px">Cada camino suma su cuello de botella al flujo</div>
        <ol style="margin:0;padding-left:20px">${r.caminos.map((p) => `<li>${p.nodos.map(esc).join(" → ")} <b>+${fmt.num(p.aumento, 1)} kg</b></li>`).join("")}</ol>`;
    } catch (e2) { mostrarError(e2); ev.target.disabled = false; }
  });
  v.querySelector("#borrar")?.addEventListener("click", async () => {
    if (!(await confirmar("Eliminar escenario", `Se borra ${id} con sus aristas y ejecuciones guardadas.`, { boton: "Eliminar", peligro: true }))) return;
    try { await api.del(`/api/red/escenarios/${encodeURIComponent(id)}`); toast("Escenario eliminado."); location.hash = "#/red"; } catch (e2) { mostrarError(e2); }
  });
  v.querySelector("#editar")?.addEventListener("click", () => editor(e, nodos, false));
  v.querySelector("#nuevo")?.addEventListener("click", () => editor(e, nodos, true));
}

function editor(base, nodos, nuevo) {
  const opts = (sel) => nodos.map((n) => `<option value="${esc(n.id_nodo)}" ${n.id_nodo === sel ? "selected" : ""}>${esc(n.id_nodo)} · ${esc(n.nombre_nodo)}</option>`).join("");
  const fila = (a = {}) => `<div class="fila-disp" style="grid-template-columns:1fr 1fr 120px 40px">
    <div class="campo"><select name="o" required aria-label="Desde"><option value="">Desde…</option>${opts(a.id_nodo_origen)}</select><span class="msg"></span></div>
    <div class="campo"><select name="d" required aria-label="Hacia"><option value="">Hacia…</option>${opts(a.id_nodo_destino)}</select><span class="msg"></span></div>
    <div class="campo"><input name="c" type="number" min="0.01" max="100000" step="0.01" required value="${a.capacidad_kg ?? ""}" aria-label="Capacidad kg" placeholder="kg"><span class="msg"></span></div>
    <button type="button" class="btn-icono" data-quitar aria-label="Quitar arista">${icono("borrar")}</button></div>`;
  const m = formulario({
    titulo: nuevo ? "Nuevo escenario" : `Editar ${base.id_escenario}`, ancho: true, boton: "Guardar",
    subtitulo: nuevo ? `Se parte de las aristas de ${base.id_escenario}; cambie las capacidades para comparar.` : "Si ya tiene ejecuciones, solo se pueden cambiar capacidades o agregar aristas.",
    valores: nuevo ? { periodo: base.periodo } : base,
    campos: [{ n: "nombre_escenario", l: "Nombre", req: true, minlength: 3, maxlength: 100 }, { n: "periodo", l: "Periodo", req: true, maxlength: 30, valor: "semana" },
      { n: "descripcion", l: "Descripción", tipo: "textarea", maxlength: 300, completo: true }],
    extra: `<div class="campo completo"><label>Aristas (capacidad en kg por periodo)</label><div class="filas-disp" id="aristas">${base.aristas.map(fila).join("")}</div>
      <button type="button" class="btn suave chico" id="otra" style="justify-self:start;margin-top:4px">${icono("mas")}Agregar arista</button></div>`,
    enviar: async (d, form) => {
      const aristas = [...form.querySelectorAll("#aristas .fila-disp")].map((f) => ({
        id_nodo_origen: f.querySelector("[name=o]").value, id_nodo_destino: f.querySelector("[name=d]").value, capacidad_kg: Number(f.querySelector("[name=c]").value) }));
      const cuerpo = { ...d, aristas, id_nodo_fuente: base.id_nodo_fuente, id_nodo_sumidero: base.id_nodo_sumidero };
      const r = nuevo ? await api.post("/api/red/escenarios", cuerpo) : await api.put(`/api/red/escenarios/${encodeURIComponent(base.id_escenario)}`, cuerpo);
      toast(`Escenario ${r.id_escenario} guardado. Ejecute el algoritmo para ver el resultado.`);
      if (location.hash === `#/red/${r.id_escenario}`) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = `#/red/${r.id_escenario}`;
    },
  });
  const cont = m.raiz.querySelector("#aristas");
  m.raiz.querySelector("#otra").onclick = () => cont.insertAdjacentHTML("beforeend", fila());
  cont.addEventListener("click", (ev) => { if (ev.target.closest("[data-quitar]") && cont.children.length > 1) ev.target.closest(".fila-disp").remove(); });
}
