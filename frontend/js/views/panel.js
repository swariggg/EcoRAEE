import { api } from "../api.js";
import { HERO, icono, iconoCategoria } from "../ilustraciones.js";
import { esc, estado, fmt, tabla } from "../ui.js";

const ORDEN = ["Registrado", "Recolectado", "Evaluado", "Reacondicionamiento", "Asignado", "Reciclaje", "Valorizado", "Disposicion", "Cerrado"];

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function barras(filas, total) {
  const max = Math.max(1, ...filas.map((f) => f.n));
  return `<div class="barras" role="list">${ORDEN.map((e) => filas.find((f) => f.estado_actual === e) || { estado_actual: e, n: 0, kg: 0 })
    .map((f) => `<div class="barra-fila" role="listitem" title="${esc(f.estado_actual)}: ${f.n} equipos · ${fmt.kg(f.kg)}">
      <span>${estado(f.estado_actual)}</span>
      <div class="pista"><div class="relleno" style="width:${(100 * f.n) / max}%"></div></div>
      <span class="num">${f.n} <small>${total ? Math.round((100 * f.n) / total) : 0}%</small></span></div>`).join("")}</div>`;
}

function anillo(c) {
  const r = 46, L = 2 * Math.PI * r, pct = Math.min(100, Number(c.ocupacion_pct) || 0);
  return `<div class="anillo" title="${esc(c.nombre_centro)}: ${c.ocupacion_actual_unidades} de ${c.capacidad_unidades} unidades">
    <svg viewBox="0 0 110 110" role="img" aria-label="${esc(c.nombre_centro)} al ${pct}%">
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="#E7F5DC" stroke-width="10"/>
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="${pct >= 90 ? "#A8432F" : "#728156"}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${(L * pct) / 100} ${L}" transform="rotate(-90 55 55)"/>
      <text x="55" y="53" text-anchor="middle" font-family="Fraunces, serif" font-size="24" font-weight="600" fill="#2C3320">${Math.round(pct)}%</text>
      <text x="55" y="71" text-anchor="middle" font-size="10" fill="#868D7C">${c.ocupacion_actual_unidades}/${c.capacidad_unidades} u</text>
    </svg><div class="t">${esc(c.nombre_centro)}</div><div class="s">${pct >= 90 ? "Casi lleno" : "Ocupación"}</div></div>`;
}

export async function render(v, { usuario, rol }) {
  const [p, cats] = await Promise.all([api.get("/api/panel"), api.get("/api/dispositivos")]);
  const ahora = new Date();
  const hero = `<section class="hero">
    <div>
      <span class="chip-rol">${icono("hoja")} ${esc(usuario.nombre_rol)}</span>
      <h2>${saludo()}, ${esc(usuario.nombres)}</h2>
      <p>${rol === "GEN" ? "Aquí puede seguir cada equipo que entregó, desde su registro hasta su nuevo destino."
        : "Así va la trazabilidad de los aparatos eléctricos y electrónicos de la universidad."}</p>
      <div class="hora">${ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
        <span style="font-size:15px;color:var(--ink-3);font-family:var(--font)">${ahora.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}</span></div>
    </div>${HERO}</section>`;

  if (rol === "GEN") {
    const total = p.por_estado.reduce((a, f) => a + f.n, 0);
    const kg = p.por_estado.reduce((a, f) => a + Number(f.kg || 0), 0);
    v.innerHTML = `${hero}
      <div class="grid g-3">
        <div class="kpi t1"><span class="et"><span class="ic">${icono("solicitud")}</span>Solicitudes</span><span class="val">${p.solicitudes}</span></div>
        <div class="kpi t2"><span class="et"><span class="ic">${icono("dispositivo")}</span>Equipos entregados</span><span class="val">${total}</span></div>
        <div class="kpi t3"><span class="et"><span class="ic">${icono("peso")}</span>Peso total</span><span class="val">${fmt.num(kg, 1)}<small>kg</small></span></div>
      </div>
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Mis equipos por estado</h3><div class="sub">Cada barra es el número de equipos</div></div>
        <a class="btn" href="#/solicitudes">${icono("mas")}Nueva solicitud</a></div>${barras(p.por_estado, total)}</div>`;
    return;
  }

  const porCat = {};
  cats.forEach((d) => { porCat[d.nombre_categoria] = (porCat[d.nombre_categoria] || 0) + 1; });
  v.innerHTML = `${hero}
    <div class="grid g-4">
      <div class="kpi t1"><span class="et"><span class="ic">${icono("dispositivo")}</span>Equipos en inventario</span>
        <span class="val">${p.en_inventario}<small>de ${p.total_dispositivos}</small></span><span class="pie">Están hoy en un centro</span></div>
      <div class="kpi t2"><span class="et"><span class="ic">${icono("reciclar")}</span>Kg recuperados</span>
        <span class="val">${fmt.num(p.kg_recuperados, 1)}<small>kg</small></span><span class="pie">Reutilizados o valorizados de ${fmt.kg(p.kg_totales)}</span></div>
      <div class="kpi t3"><span class="et"><span class="ic">${icono("centro")}</span>Capacidad usada</span>
        <span class="val">${fmt.num(p.capacidad_usada_pct, 1)}<small>%</small></span><span class="pie">Suma de todos los centros</span></div>
      <div class="kpi t4"><span class="et"><span class="ic">${icono("check")}</span>Trazabilidad cerrada</span>
        <span class="val">${fmt.num(p.trazabilidad_pct, 1)}<small>%</small></span><span class="pie">Equipos con ciclo completo</span></div>
    </div>
    <div class="grid g-panel">
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Equipos por estado del ciclo de vida</h3><div class="sub">Número de equipos y porcentaje del total</div></div></div>
        ${barras(p.por_estado, p.total_dispositivos)}</div>
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Pendientes</h3><div class="sub">Trabajo abierto ahora</div></div></div>
        <div class="grid" style="gap:10px">
          <a class="kpi t1" href="#/solicitudes" style="text-decoration:none;color:inherit"><span class="et">Solicitudes por recibir</span><span class="val">${p.solicitudes_pendientes}</span></a>
          <a class="kpi t2" href="#/movimientos" style="text-decoration:none;color:inherit"><span class="et">Movimientos abiertos</span><span class="val">${p.movimientos_abiertos}</span></a>
          <a class="kpi t3" href="#/transferencias" style="text-decoration:none;color:inherit"><span class="et">Transferencias sin evidencia</span><span class="val">${p.transferencias_abiertas}</span></a>
          <a class="kpi t4" href="#/alertas" style="text-decoration:none;color:inherit"><span class="et">Alertas de capacidad</span><span class="val">${p.alertas_abiertas}</span></a>
        </div></div>
    </div>
    <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Ocupación de los centros</h3><div class="sub">Unidades guardadas frente a su capacidad (alerta desde 90 %)</div></div>
      <a class="btn suave chico" href="#/centros">Ver centros</a></div><div class="anillos">${p.centros.map(anillo).join("")}</div></div>
    <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Equipos por categoría</h3><div class="sub">Toque una categoría para ver sus equipos</div></div>
      <a class="btn suave chico" href="#/dispositivos">Ver todos</a></div>
      <div class="categorias">${Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([cat, n], i) => {
        const id = cats.find((d) => d.nombre_categoria === cat)?.id_categoria;
        return `<a class="cat" href="#/dispositivos?categoria=${esc(id)}">${i === 0 ? '<span class="tag">Más recibidos</span>' : ""}${iconoCategoria(cat)}<b>${esc(cat)}</b><span>${n} equipos</span></a>`;
      }).join("")}</div></div>
    <div class="grid g-2">
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Cuellos de botella (escenario base)</h3><div class="sub">Aristas del corte mínimo de la red: limitan el flujo hacia los destinos</div></div>
        <a class="btn suave chico" href="#/red">Ver red</a></div>
        ${tabla(p.cuellos_botella, [
          { t: "Desde", v: (f) => esc(f.nombre_origen) }, { t: "Hacia", v: (f) => esc(f.nombre_destino) },
          { t: "Capacidad", v: (f) => fmt.kg(f.capacidad_kg), clase: "nowrap" }, { t: "Flujo", v: (f) => fmt.kg(f.flujo_kg), clase: "nowrap" }],
          { vacioTexto: "Ejecute el flujo máximo para ver los cuellos de botella." })}</div>
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Últimos cambios de estado</h3><div class="sub">Del historial (lo llena un trigger)</div></div></div>
        ${tabla(p.ultimos_cambios, [
          { t: "Equipo", v: (f) => `<a href="#/dispositivos/${esc(f.id_dispositivo)}">${esc(f.id_dispositivo)}</a>` },
          { t: "Cambio", v: (f) => `${estado(f.estado_nuevo)}` },
          { t: "Responsable", v: (f) => esc(f.responsable) }, { t: "Fecha", v: (f) => fmt.fechaHora(f.fecha_cambio), clase: "nowrap" }])}</div>
    </div>`;
}
