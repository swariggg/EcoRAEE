// Inicio: titular con palabra resaltada, imagen recortada, cinta y estadísticas solo con números.
import { api } from "../api.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { esc, estado, fmt, tabla } from "../ui.js?v=20261103b";

const FOTO = "assets/img/raee-equipos.jpg";

// Botón principal según lo que cada rol hace más seguido.
const ACCION = {
  GEN: ["#/solicitudes", "Nueva solicitud"], OPE: ["#/solicitudes", "Ver solicitudes"], COO: ["#/dispositivos", "Ver equipos"],
  TEC: ["#/evaluaciones", "Evaluar equipos"], REA: ["#/transferencias", "Ver destinos asignados"], BEN: ["#/transferencias", "Ver destinos asignados"],
  ADM: ["#/dispositivos", "Ver equipos"],
};

const numero = (valor, unidad, texto, clase = "t2", enlace = "") => {
  const tag = enlace ? "a" : "div";
  return `<${tag} class="kpi ${clase}"${enlace ? ` href="${enlace}"` : ""}>
    <span class="val">${valor}${unidad ? `<small>${unidad}</small>` : ""}</span><span class="pie">${texto}</span></${tag}>`;
};

export async function render(v, { usuario, rol }) {
  const p = await api.get("/api/panel");
  const [destino, etiqueta] = ACCION[rol] || ACCION.ADM;
  const iniciales = `${(usuario.nombres || "?")[0]}${(usuario.apellidos || "")[0] || ""}`.toUpperCase();
  const gen = rol === "GEN";

  const titular = `<section class="inicio-titular">
      <div class="lado">
        <div style="display:flex;gap:10px"><span class="burbuja-ic">${icono("hoja")}</span><span class="burbuja-ic oscura">${icono("reciclar")}</span></div>
        <p>${gen ? "Aquí sigue cada equipo que entregó, desde su registro hasta su nuevo destino."
          : "Somos el sistema de la universidad que sigue cada aparato eléctrico y electrónico hasta su nuevo destino."}</p>
      </div>
      <h1>Dale una <span class="resaltar">nueva vida</span> a cada equipo</h1>
      <div class="lado der">
        <a class="burbuja-ic borde" href="${destino}" aria-label="${esc(etiqueta)}">${icono("flecha")}</a>
        <a class="btn suave" href="#/dispositivos">${gen ? "Mis equipos" : "Explorar equipos"} ${icono("flecha")}</a>
      </div>
    </section>
    <section class="escaparate">
      <div class="equipo-lado"><span class="avatar">${esc(iniciales)}</span><b>${esc(usuario.nombres)}</b><span>${esc(usuario.nombre_rol)}</span></div>
      <div class="foto-recorte">
        <img src="${FOTO}" alt="Computadores, monitor, impresora y teclado en desuso apilados" loading="eager">
        <div class="etiquetas"><div><span>Reutilizar</span><span>Reparar</span></div><div><span>Reciclar</span><span>Trazar</span></div></div>
      </div>
    </section>
    <div class="inicio-acciones"><a class="btn texto" href="#/dispositivos">Explorar más</a><a class="btn" href="${destino}">${esc(etiqueta)}</a></div>
    <div class="cinta" aria-hidden="true"><div>${Array(16).fill("<span>Cada equipo cuenta</span>").join("")}</div></div>`;

  if (gen) {
    const total = p.por_estado.reduce((a, f) => a + f.n, 0);
    const kg = p.por_estado.reduce((a, f) => a + Number(f.kg || 0), 0);
    const cerrados = p.por_estado.find((f) => f.estado_actual === "Cerrado")?.n || 0;
    v.innerHTML = `${titular}
      <section class="numeros" style="grid-template-columns:1fr minmax(240px,1.2fr) 1fr" aria-label="Mis números">
        <div class="col">${numero(p.solicitudes, "", "solicitudes de entrega registradas", "t1", "#/solicitudes")}
          ${numero(total, "", "equipos entregados por usted", "t2", "#/dispositivos")}</div>
        <div class="foto-centro"><img src="${FOTO}" alt=""><span class="globo">Gracias por entregar sus equipos</span></div>
        <div class="col">${numero(fmt.num(kg, 1), "kg", "de residuos electrónicos que no fueron a la basura", "t3")}
          ${numero(cerrados, "", "equipos ya tienen destino final confirmado", "t4")}</div>
      </section>
      ${declaracion(gen)}`;
    return;
  }

  v.innerHTML = `${titular}
    <section class="numeros" aria-label="Estadísticas">
      <div class="col">${numero(`+${p.total_dispositivos}`, "", "equipos registrados en el sistema", "t1", "#/dispositivos")}
        ${numero(p.en_inventario, "", "equipos están hoy en un centro", "t2", "#/centros")}</div>
      <div class="col">${numero(fmt.num(p.kg_recuperados, 1), "kg", `reutilizados o valorizados de ${fmt.kg(p.kg_totales)}`, "t3")}
        ${numero(`${fmt.num(p.trazabilidad_pct, 0)}`, "%", "de los equipos con ciclo de vida cerrado", "t4")}</div>
      <div class="foto-centro"><img src="${FOTO}" alt=""><span class="globo">Trazabilidad de RAEE en la universidad</span></div>
      <div class="col">${numero(p.solicitudes_pendientes, "", "solicitudes esperan ser recibidas", "t2", "#/solicitudes")}
        ${numero(p.movimientos_abiertos, "", "movimientos entre centros abiertos", "t1", "#/movimientos")}</div>
      <div class="col">${numero(p.transferencias_abiertas, "", "transferencias esperan evidencia", "t3", "#/transferencias")}
        ${numero(`${fmt.num(p.capacidad_usada_pct, 0)}`, "%", `de la capacidad de los centros en uso · ${p.alertas_abiertas} alerta${p.alertas_abiertas === 1 ? "" : "s"}`, "t2 borde-anillos", "#/alertas")}</div>
    </section>
    ${declaracion(gen, rol)}
    <section class="tarjeta">
      <span class="pildora">Actividad reciente</span>
      <div class="tarjeta-cab"><div><h3>Últimos cambios de estado</h3><div class="sub">Del historial de cada equipo (lo registra un trigger)</div></div>
        <a class="btn texto" href="#/dispositivos">Ver todos ${icono("flechaDer")}</a></div>
      ${tabla(p.ultimos_cambios, [
        { t: "Equipo", v: (f) => `<a href="#/dispositivos/${esc(f.id_dispositivo)}"><b>${esc(f.id_dispositivo)}</b></a>` },
        { t: "Nuevo estado", v: (f) => estado(f.estado_nuevo) },
        { t: "Responsable", v: (f) => esc(f.responsable) }, { t: "Fecha", v: (f) => fmt.fechaHora(f.fecha_cambio), clase: "nowrap" }])}
    </section>`;
}

function declaracion(gen, rol) {
  const red = ["COO", "ADM", "OPE", "TEC"].includes(rol);
  return `<section class="declaracion">
    <p>EcoRAEE registra, evalúa y asigna un destino a los equipos en desuso de la universidad, con evidencia en cada paso del camino.</p>
    <div>
      <h2>Protegemos el ambiente para las próximas generaciones, un equipo a la vez.</h2>
      <div class="acciones">
        ${gen ? `<a class="btn suave" href="#/solicitudes">Mis solicitudes</a><a class="btn texto" href="#/dispositivos">Ver mis equipos ${icono("flechaDer")}</a>`
          : `${red ? `<a class="btn suave" href="#/red">Red y flujo máximo</a>` : ""}<a class="btn texto" href="#/dispositivos">Ver equipos ${icono("flechaDer")}</a>`}
      </div>
    </div>
  </section>`;
}
