// Acciones del ciclo de vida que se usan desde varias pantallas.
import { api, API_BASE, catalogo, limpiarCache, sesion } from "./api.js?v=20261103b";
import { formulario, opciones, toast } from "./ui.js?v=20261103b";

export async function evaluar(idDispositivo, alTerminar) {
  const [conds, clas] = await Promise.all([catalogo("/api/catalogos/condiciones"), catalogo("/api/catalogos/clasificaciones")]);
  formulario({
    titulo: "Registrar evaluación técnica", subtitulo: `Equipo ${idDispositivo}. Pasa a Evaluado (RN-02: solo técnicos).`, boton: "Guardar evaluación",
    campos: [
      { n: "id_condicion", l: "Condición", tipo: "select", req: true, opciones: opciones(conds, "id_condicion", (c) => `${c.nombre_condicion}${c.descripcion ? ` · ${c.descripcion}` : ""}`) },
      { n: "id_clasificacion", l: "Clasificación", tipo: "select", req: true, opciones: opciones(clas, "id_clasificacion", "nombre_clasificacion"), ayuda: "Define a qué destinos puede ir (RN-04)." },
      { n: "diagnostico", l: "Diagnóstico", tipo: "textarea", req: true, minlength: 10, maxlength: 500, completo: true, placeholder: "Qué se revisó y qué se encontró" },
    ],
    enviar: async (d) => {
      const r = await api.post("/api/evaluaciones", { ...d, id_dispositivo: idDispositivo });
      toast(`Evaluación ${r.id_evaluacion} guardada: ${r.nombre_clasificacion}.`);
      alTerminar?.();
    },
  });
}

export async function mover(disp, alTerminar) {
  const centros = (await api.get("/api/centros")).filter((c) => c.id_centro !== disp.id_centro_actual);
  formulario({
    titulo: "Mover a otro centro", subtitulo: `Equipo ${disp.id_dispositivo} desde ${disp.nombre_centro || "—"}. Es atómico: si el centro está lleno, no cambia nada (RN-06).`,
    boton: "Mover",
    campos: [
      { n: "id_centro_destino", l: "Centro destino", tipo: "select", req: true, opciones: opciones(centros, "id_centro", (c) => `${c.nombre_centro} (${c.capacidad_unidades - c.ocupacion_actual_unidades} libres)`) },
      { n: "ubicacion", l: "Ubicación en el centro", req: true, maxlength: 30, placeholder: "Mesa 1" },
    ],
    enviar: async (d) => {
      const r = await api.post("/api/movimientos", { ...d, id_dispositivo: disp.id_dispositivo });
      toast(`Movimiento ${r.id_movimiento} abierto. Súbale una evidencia para cerrarlo (RN-03).`);
      limpiarCache("/api/centros");
      alTerminar?.();
    },
  });
}

export async function asignarDestino(disp, alTerminar) {
  const [destinos, compat] = await Promise.all([api.get("/api/destinos"), catalogo("/api/catalogos/compatibilidad")]);
  const permitidos = new Set(compat.filter((c) => c.nombre_clasificacion === disp.clasificacion).map((c) => c.id_tipo_destino));
  let lista = destinos.filter((d) => permitidos.has(d.id_tipo_destino));
  // Un equipo reacondicionado solo puede ir a un beneficiario (ciclo de vida).
  if (disp.estado_actual === "Reacondicionamiento") lista = lista.filter((d) => d.id_tipo_destino === "TD-BEN");
  if (disp.estado_actual === "Evaluado") lista = lista.filter((d) => d.id_tipo_destino !== "TD-BEN");
  formulario({
    titulo: "Asignar destino", boton: "Asignar",
    subtitulo: `Equipo ${disp.id_dispositivo} · clasificación ${disp.clasificacion || "sin evaluar"}. Solo se muestran destinos compatibles (RN-04).`,
    campos: [{ n: "id_destino", l: "Destino", tipo: "select", req: true, opciones: opciones(lista, "id_destino", (d) => `${d.nombre_entidad} · ${d.nombre_tipo}`) }],
    enviar: async (d) => {
      const r = await api.post("/api/transferencias", { ...d, id_dispositivo: disp.id_dispositivo });
      toast(`Transferencia ${r.id_transferencia} creada. El equipo pasó a ${r.estado_actual}.`);
      alTerminar?.();
    },
  });
}

export function subirEvidencia(origen, alTerminar) {
  const [clave, id] = Object.entries(origen)[0];
  const nombre = { id_transferencia: "la transferencia", id_movimiento: "el movimiento", id_evaluacion: "la evaluación" }[clave];
  formulario({
    titulo: "Subir evidencia", subtitulo: `Foto o acta que respalda ${nombre} ${id}. En local se guarda en backend/uploads (luego irá a S3).`, boton: "Subir",
    campos: [
      { n: "archivo", l: "Archivo (JPG, PNG o PDF, máx. 5 MB)", tipo: "file", req: true, accept: "image/jpeg,image/png,application/pdf", completo: true },
      { n: "tipo_documento", l: "Tipo de documento", req: true, minlength: 3, maxlength: 50, placeholder: "Acta de entrega, foto, guía de traslado…" },
      { n: "nivel_acceso", l: "Acceso", tipo: "select", req: true, valor: "Interno", opciones: [{ v: "Interno", t: "Interno" }, { v: "Restringido", t: "Restringido (solo coordinación)" }] },
    ],
    enviar: async (d) => {
      if (d.archivo.size > 5 * 1024 * 1024) throw new Error("El archivo supera 5 MB.");
      const fd = new FormData();
      fd.append("archivo", d.archivo);
      fd.append("tipo_documento", d.tipo_documento);
      fd.append("nivel_acceso", d.nivel_acceso);
      fd.append(clave, id);
      const r = await api.subir("/api/evidencias", fd);
      toast(`Evidencia ${r.id_evidencia} cargada.`);
      alTerminar?.();
    },
  });
}

export async function verEvidencia(id) {
  try {
    const r = await fetch(`${API_BASE}/api/evidencias/${encodeURIComponent(id)}/archivo`, { headers: { Authorization: `Bearer ${sesion()?.token}` } });
    if (!r.ok) throw new Error((await r.json()).detalle);
    const url = URL.createObjectURL(await r.blob());
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    toast(e.message || "No se pudo abrir la evidencia.", "error");
  }
}
