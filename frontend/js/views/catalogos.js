import { api } from "../api.js";
import { esc, tabla } from "../ui.js";
import { crud } from "./crud.js";

const CONF = {
  categorias: { t: "Categorías", pk: "id_categoria", campos: [{ n: "nombre_categoria", l: "Nombre", req: true, maxlength: 50, completo: true }], nombre: "nombre_categoria" },
  marcas: { t: "Marcas", pk: "id_marca", campos: [{ n: "nombre_marca", l: "Nombre", req: true, maxlength: 50, completo: true }], nombre: "nombre_marca" },
  condiciones: { t: "Condiciones", pk: "id_condicion", campos: [{ n: "nombre_condicion", l: "Nombre", req: true, maxlength: 50 }, { n: "descripcion", l: "Descripción", maxlength: 200 }], nombre: "nombre_condicion", extra: "descripcion" },
  "tipos-centro": { t: "Tipos de centro", pk: "id_tipo_centro", campos: [{ n: "nombre_tipo", l: "Nombre", req: true, maxlength: 50, completo: true }], nombre: "nombre_tipo" },
  organizaciones: { t: "Organizaciones", pk: "id_organizacion", nombre: "nombre", extra: "ubicacion",
    campos: [{ n: "nombre", l: "Nombre", req: true, maxlength: 100, completo: true }, { n: "tipo_organizacion", l: "Tipo", tipo: "select", req: true, opciones: [{ v: "Interna", t: "Interna (universidad)" }, { v: "Externa", t: "Externa" }] },
      { n: "ubicacion", l: "Ubicación", maxlength: 150 }] },
};

export async function render(v, ctx) {
  const actual = ctx.params.get("c") || "categorias";
  const c = CONF[actual] || CONF.categorias;
  const pestanas = `<div class="chips">${Object.entries(CONF).map(([k, x]) => `<a class="chip ${k === actual ? "activo" : ""}" href="#/catalogos?c=${k}">${x.t}</a>`).join("")}</div>`;
  const [compat] = await Promise.all([api.get("/api/catalogos/compatibilidad")]);
  await crud(v, {
    titulo: c.t, ruta: `/api/catalogos/${actual}`, pk: c.pk, cache: `/api/catalogos/${actual}`, puedeEditar: ctx.rol === "ADM", nombre: (f) => f[c.nombre],
    encabezado: `<div class="cabecera"><div><h1>Catálogos</h1><p>Listas que usan los formularios. Un valor en uso no se puede borrar (integridad referencial).</p></div>
      ${ctx.rol === "ADM" ? '<div class="acciones"><button class="btn" data-nuevo>Nuevo</button></div>' : ""}</div>${pestanas}`,
    columnas: [{ t: "Código", v: (f) => `<span class="mono">${esc(f[c.pk])}</span>` }, { t: "Nombre", v: (f) => `<b>${esc(f[c.nombre])}</b>` },
      ...(c.campos.some((x) => x.n === "tipo_organizacion") ? [{ t: "Tipo", v: (f) => esc(f.tipo_organizacion) }] : []),
      ...(c.extra ? [{ t: c.extra === "descripcion" ? "Descripción" : "Ubicación", v: (f) => esc(f[c.extra] || "—") }] : [])],
    campos: c.campos,
    extraArriba: "",
  });
  v.insertAdjacentHTML("beforeend", `<div class="tarjeta"><div class="tarjeta-cab"><div><h3>Clasificación → tipos de destino permitidos</h3>
    <div class="sub">Relación R ⊆ Clasificación × TipoDestino (Matemática Discreta). La usa el trigger de RN-04. Es fija.</div></div></div>
    ${tabla(compat, [{ t: "Clasificación", v: (f) => esc(f.nombre_clasificacion) }, { t: "Puede ir a", v: (f) => esc(f.nombre_tipo) }])}</div>`);
}
