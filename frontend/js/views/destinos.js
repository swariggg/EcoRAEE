import { catalogo } from "../api.js?v=20261103b";
import { esc, opciones } from "../ui.js?v=20261103b";
import { crud } from "./crud.js?v=20261103b";

export async function render(v, ctx) {
  return crud(v, {
    titulo: "Destinos", sub: "Reacondicionadores, beneficiarios, gestores de reciclaje y disposición final. Cada tipo define el estado al que pasa el equipo.",
    ruta: "/api/destinos", pk: "id_destino", puedeEditar: ["ADM", "COO"].includes(ctx.rol), nombre: (f) => f.nombre_entidad,
    columnas: [{ t: "Destino", v: (f) => `<b>${esc(f.nombre_entidad)}</b><div class="small muted">${esc(f.id_destino)}</div>` },
      { t: "Tipo", v: (f) => `${esc(f.nombre_tipo)}<div class="small muted">Estado: ${esc(f.estado_resultante)}</div>` },
      { t: "Organización", v: (f) => esc(f.organizacion || "—") }, { t: "RUC / cédula", v: (f) => `<span class="mono">${esc(f.ruc_identificacion)}</span>` },
      { t: "Certificación ambiental", v: (f) => esc(f.certificacion_ambiental || "—") }],
    campos: async () => [
      { n: "nombre_entidad", l: "Nombre de la entidad", req: true, minlength: 3, maxlength: 150, completo: true },
      { n: "id_tipo_destino", l: "Tipo de destino", tipo: "select", req: true, opciones: opciones(await catalogo("/api/catalogos/tipos-destino"), "id_tipo_destino", "nombre_tipo") },
      { n: "id_organizacion", l: "Organización que lo opera", tipo: "select", opciones: opciones(await catalogo("/api/catalogos/organizaciones"), "id_organizacion", "nombre") },
      { n: "ruc_identificacion", l: "RUC o cédula", req: true, patron: "\\d{10}(\\d{3})?", msgPatron: "10 dígitos (cédula) o 13 dígitos (RUC).", maxlength: 13 },
      { n: "certificacion_ambiental", l: "Certificación ambiental", maxlength: 100, ayuda: "Obligatoria en la práctica para gestores y disposición." },
    ],
  });
}
