// Pantalla genérica de lista + crear/editar/eliminar (centros, destinos, catálogos, usuarios).
import { api, limpiarCache } from "../api.js?v=20261103b";
import { icono } from "../ilustraciones.js?v=20261103b";
import { confirmar, esc, formulario, mostrarError, tabla, toast } from "../ui.js?v=20261103b";

/**
 * conf: { titulo, sub, ruta, pk, columnas, campos (o async fn), puedeEditar, textoBorrar, nombre(fila), cache, alClic, sinBorrar }
 */
export async function crud(v, conf) {
  const filas = await api.get(conf.ruta);
  const editar = conf.puedeEditar;
  v.innerHTML = `${conf.encabezado ?? `<div class="cabecera"><div><h1>${esc(conf.titulo)}</h1><p>${esc(conf.sub || "")}</p></div>
      ${editar ? `<div class="acciones"><button class="btn" data-nuevo>${icono("mas")}Nuevo</button></div>` : ""}</div>`}
    ${conf.extraArriba || ""}
    <div data-lista>${tabla(filas, conf.columnas, {
      alClic: conf.alClic,
      acciones: editar ? (f) => `<button class="btn suave chico" data-editar="${esc(f[conf.pk])}">${icono("editar")}Editar</button>${conf.sinBorrar?.(f) ? "" :
        `<button class="btn peligro chico" data-borrar="${esc(f[conf.pk])}" aria-label="${esc(conf.textoBorrar || "Eliminar")}">${icono("borrar")}</button>`}` : null,
    })}</div>`;
  const recargar = () => { if (conf.cache) limpiarCache(conf.cache); crud(v, conf); };
  const abrir = async (fila) => {
    const campos = typeof conf.campos === "function" ? await conf.campos(fila) : conf.campos;
    formulario({
      titulo: fila ? `Editar ${conf.nombre(fila)}` : `Nuevo registro · ${conf.titulo}`, campos, valores: fila || {},
      enviar: async (d) => {
        if (fila) await api.put(`${conf.ruta}/${encodeURIComponent(fila[conf.pk])}`, conf.preparar ? conf.preparar(d, fila) : d);
        else await api.post(conf.ruta, conf.preparar ? conf.preparar(d) : d);
        toast(fila ? "Cambios guardados." : "Registro creado.");
        recargar();
      },
    });
  };
  v.querySelector("[data-nuevo]")?.addEventListener("click", () => abrir(null));
  v.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => abrir(filas.find((f) => String(f[conf.pk]) === b.dataset.editar))));
  v.querySelectorAll("[data-borrar]").forEach((b) => b.addEventListener("click", async () => {
    const f = filas.find((x) => String(x[conf.pk]) === b.dataset.borrar);
    if (!(await confirmar(conf.textoBorrar || "Eliminar", `${conf.textoBorrar || "Eliminar"} ${conf.nombre(f)}? ${conf.avisoBorrar || "Si otros registros lo usan, la base no lo permitirá."}`, { boton: conf.textoBorrar || "Eliminar", peligro: true }))) return;
    try { await api.del(`${conf.ruta}/${encodeURIComponent(f[conf.pk])}`); toast("Listo."); recargar(); } catch (e) { mostrarError(e); }
  }));
  if (conf.alClic) v.querySelectorAll("[data-lista] tbody tr").forEach((tr) => tr.addEventListener("click", (e) => {
    if (!e.target.closest("button")) conf.alClic(filas[Number(tr.dataset.i)]);
  }));
}
