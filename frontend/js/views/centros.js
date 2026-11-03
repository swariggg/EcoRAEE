import { api, catalogo } from "../api.js";
import { esc, estado, fmt, opciones, tabla } from "../ui.js";
import { crud } from "./crud.js";

export async function render(v, ctx) {
  if (ctx.id) {
    const c = await api.get(`/api/centros/${encodeURIComponent(ctx.id)}`);
    v.innerHTML = `<div class="migas"><a href="#/centros">Centros</a> / ${esc(c.id_centro)}</div>
      <div class="cabecera"><div><h1>${esc(c.nombre_centro)}</h1><p>${esc(c.nombre_tipo)} · ${c.ocupacion_actual_unidades} de ${c.capacidad_unidades} unidades (${fmt.num(c.ocupacion_pct, 1)} %) · ${fmt.kg(c.kg_en_centro)}</p></div></div>
      <div class="tarjeta"><div class="tarjeta-cab"><div><h3>Inventario actual</h3><div class="sub">Vista vw_inventario</div></div></div>
      ${tabla(c.inventario, [{ t: "Equipo", v: (d) => `<a href="#/dispositivos/${esc(d.id_dispositivo)}">${esc(d.id_dispositivo)}</a>` },
        { t: "Categoría", v: (d) => esc(d.nombre_categoria) }, { t: "Peso", v: (d) => fmt.kg(d.peso_kg) }, { t: "Ubicación", v: (d) => esc(d.ubicacion_centro || "—") },
        { t: "Ingreso", v: (d) => fmt.fecha(d.fecha_ingreso_centro) }, { t: "Estado", v: (d) => estado(d.estado_actual) }], { vacioTexto: "El centro está vacío." })}</div>`;
    return;
  }
  return crud(v, {
    titulo: "Centros", sub: "Puntos de acopio, laboratorios y bodegas. La ocupación la actualizan los procedimientos (RN-06).",
    ruta: "/api/centros", pk: "id_centro", cache: "/api/centros", puedeEditar: ctx.rol === "ADM", nombre: (f) => f.nombre_centro,
    alClic: (f) => (location.hash = `#/centros/${f.id_centro}`),
    columnas: [{ t: "Centro", v: (f) => `<b>${esc(f.nombre_centro)}</b><div class="small muted">${esc(f.id_centro)}</div>` }, { t: "Tipo", v: (f) => esc(f.nombre_tipo) },
      { t: "Ocupación", v: (f) => `${f.ocupacion_actual_unidades} / ${f.capacidad_unidades} u <span class="small muted">(${fmt.num(f.ocupacion_pct, 1)} %)</span>` },
      { t: "Volumen", v: (f) => `${fmt.num(f.capacidad_volumetrica_m3, 2)} m³` }, { t: "Peso guardado", v: (f) => fmt.kg(f.kg_en_centro) }],
    campos: async () => [
      { n: "nombre_centro", l: "Nombre", req: true, minlength: 3, maxlength: 100, completo: true },
      { n: "id_tipo_centro", l: "Tipo", tipo: "select", req: true, opciones: opciones(await catalogo("/api/catalogos/tipos-centro"), "id_tipo_centro", "nombre_tipo") },
      { n: "capacidad_unidades", l: "Capacidad (unidades)", tipo: "number", req: true, min: 1, max: 100000, step: 1, ayuda: "No puede ser menor que la ocupación actual." },
      { n: "capacidad_volumetrica_m3", l: "Capacidad (m³)", tipo: "number", req: true, min: 0.01, max: 100000, step: 0.01 },
    ],
  });
}
