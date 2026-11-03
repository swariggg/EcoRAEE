import { api } from "../api.js";
import { esc, fmt, tabla } from "../ui.js";

export async function render(v, ctx) {
  const t = ctx.params.get("tabla") || "";
  const filas = await api.get(`/api/auditoria${t ? `?tabla=${encodeURIComponent(t)}` : ""}`);
  v.innerHTML = `<div class="cabecera"><div><h1>Auditoría</h1><p>Quién hizo qué y cuándo. La llenan los triggers, los procedimientos y el login (últimos 200).</p></div></div>
    <div class="chips">${["", "dispositivo", "evaluacion", "transferencia", "usuario", "solicitud"].map((x) =>
      `<a class="chip ${x === t ? "activo" : ""}" href="#/auditoria${x ? `?tabla=${x}` : ""}">${x || "Todo"}</a>`).join("")}</div>
    ${tabla(filas, [{ t: "#", v: (f) => f.id_auditoria }, { t: "Fecha", v: (f) => fmt.fechaHora(f.fecha), clase: "nowrap" },
      { t: "Tabla", v: (f) => `<span class="mono">${esc(f.tabla_afectada)}</span>` }, { t: "Operación", v: (f) => `<b>${esc(f.operacion)}</b>` },
      { t: "Detalle", v: (f) => esc(f.detalle) }, { t: "Usuario", v: (f) => esc(f.usuario || "—") }])}`;
}
