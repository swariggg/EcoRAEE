"""Procesos del ciclo de vida: evaluación técnica, movimientos entre centros,
transferencias a destinos y tratamientos. Cada operación usa el procedimiento
almacenado correspondiente, así las reglas de negocio (triggers) se aplican siempre."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import ejecutar, get_db, siguiente_id, todos, uno
from ..seguridad import PERSONAL, requiere

router = APIRouter(prefix="/api", tags=["Procesos del ciclo de vida"])


# ------------------------------------------------------------------ evaluaciones
class Evaluacion(BaseModel):
    id_dispositivo: str = Field(min_length=1, max_length=20)
    id_condicion: str = Field(min_length=1, max_length=20)
    id_clasificacion: str = Field(min_length=1, max_length=20)
    diagnostico: str = Field(min_length=10, max_length=500)


class EvaluacionEditar(BaseModel):
    id_condicion: str = Field(min_length=1, max_length=20)
    id_clasificacion: str = Field(min_length=1, max_length=20)
    diagnostico: str = Field(min_length=10, max_length=500)


SQL_EVAL = """SELECT e.id_evaluacion, e.id_dispositivo, cat.nombre_categoria, e.fecha_evaluacion, e.diagnostico,
       e.id_condicion, co.nombre_condicion, e.id_clasificacion, cl.nombre_clasificacion,
       e.id_usuario_tecnico, u.nombres + ' ' + u.apellidos AS tecnico, d.estado_actual
FROM evaluacion e JOIN dispositivo d ON d.id_dispositivo = e.id_dispositivo
JOIN categoria cat ON cat.id_categoria = d.id_categoria
JOIN condicion co ON co.id_condicion = e.id_condicion
JOIN clasificacion cl ON cl.id_clasificacion = e.id_clasificacion
JOIN usuario u ON u.id_usuario = e.id_usuario_tecnico"""


@router.get("/evaluaciones")
def listar_evaluaciones(dispositivo: Optional[str] = None, cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    if dispositivo:
        return todos(cn, SQL_EVAL + " WHERE e.id_dispositivo = ? ORDER BY e.fecha_evaluacion DESC", dispositivo)
    return todos(cn, SQL_EVAL + " ORDER BY e.fecha_evaluacion DESC, e.id_evaluacion DESC")


@router.post("/evaluaciones", status_code=201)
def registrar_evaluacion(d: Evaluacion, cn=Depends(get_db), u: dict = Depends(requiere("TEC"))):
    if u["id_rol"] != "TEC":
        raise HTTPException(403, "RN-02: solo un técnico evaluador registra evaluaciones.")
    nuevo = siguiente_id(cn, "evaluacion", "id_evaluacion", "EV-")
    ejecutar(cn, "EXEC sp_registrar_evaluacion ?, ?, ?, ?, ?, ?", nuevo, d.id_dispositivo, u["id_usuario"],
             d.id_condicion, d.id_clasificacion, d.diagnostico.strip())
    return uno(cn, SQL_EVAL + " WHERE e.id_evaluacion = ?", nuevo)


@router.put("/evaluaciones/{id}")
def corregir_evaluacion(id: str, d: EvaluacionEditar, cn=Depends(get_db), u: dict = Depends(requiere("TEC"))):
    if u["id_rol"] != "TEC":
        raise HTTPException(403, "RN-02: solo un técnico evaluador corrige evaluaciones.")
    ev = uno(cn, SQL_EVAL + " WHERE e.id_evaluacion = ?", id)
    if not ev:
        raise HTTPException(404, "Evaluación no encontrada.")
    if ev["estado_actual"] != "Evaluado":
        raise HTTPException(409, "Solo se corrige la evaluación mientras el equipo no tenga destino.")
    ejecutar(cn, """UPDATE evaluacion SET id_condicion = ?, id_clasificacion = ?, diagnostico = ?, id_usuario_tecnico = ?
                    WHERE id_evaluacion = ?""", d.id_condicion, d.id_clasificacion, d.diagnostico.strip(), u["id_usuario"], id)
    return uno(cn, SQL_EVAL + " WHERE e.id_evaluacion = ?", id)


# ------------------------------------------------------------------ movimientos
class Movimiento(BaseModel):
    id_dispositivo: str = Field(min_length=1, max_length=20)
    id_centro_destino: str = Field(min_length=1, max_length=20)
    ubicacion: str = Field(min_length=1, max_length=30)


SQL_MOV = """SELECT mv.id_movimiento, mv.id_dispositivo, mv.id_centro_origen, co.nombre_centro AS origen,
       mv.id_centro_destino, cd.nombre_centro AS destino, mv.fecha_salida, mv.fecha_recepcion, mv.estado_movimiento,
       u.nombres + ' ' + u.apellidos AS coordinador,
       (SELECT COUNT(*) FROM evidencia ev WHERE ev.id_movimiento = mv.id_movimiento) AS n_evidencias
FROM movimiento mv JOIN centro co ON co.id_centro = mv.id_centro_origen
JOIN centro cd ON cd.id_centro = mv.id_centro_destino
JOIN usuario u ON u.id_usuario = mv.id_usuario_coordinador"""


@router.get("/movimientos")
def listar_movimientos(estado: Optional[str] = None, cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    if estado:
        return todos(cn, SQL_MOV + " WHERE mv.estado_movimiento = ? ORDER BY mv.fecha_salida DESC", estado)
    return todos(cn, SQL_MOV + " ORDER BY mv.fecha_salida DESC, mv.id_movimiento DESC")


@router.post("/movimientos", status_code=201)
def mover(d: Movimiento, cn=Depends(get_db), u: dict = Depends(requiere("COO"))):
    nuevo = siguiente_id(cn, "movimiento", "id_movimiento", "MOV-")
    # Atómico: si el centro destino está lleno, el CHECK revierte la operación (CP-05).
    ejecutar(cn, "EXEC sp_mover_dispositivo ?, ?, ?, ?, ?", nuevo, d.id_dispositivo, d.id_centro_destino,
             d.ubicacion.strip(), u["id_usuario"])
    return uno(cn, SQL_MOV + " WHERE mv.id_movimiento = ?", nuevo)


@router.post("/movimientos/{id}/cerrar")
def cerrar_movimiento(id: str, cn=Depends(get_db), _: dict = Depends(requiere("COO", "OPE"))):
    ejecutar(cn, "EXEC sp_cerrar_movimiento ?", id)          # RN-03: exige evidencia
    return uno(cn, SQL_MOV + " WHERE mv.id_movimiento = ?", id)


# ------------------------------------------------------------------ transferencias
class Transferencia(BaseModel):
    id_dispositivo: str = Field(min_length=1, max_length=20)
    id_destino: str = Field(min_length=1, max_length=20)


SQL_TRA = """SELECT t.id_transferencia, t.id_dispositivo, cat.nombre_categoria, t.id_destino, de.nombre_entidad,
       td.nombre_tipo AS tipo_destino, t.fecha_transferencia, t.estado_cierre, t.fecha_confirmacion_cierre,
       d.estado_actual, u.nombres + ' ' + u.apellidos AS coordinador,
       tr.id_tratamiento, tr.tipo_tratamiento, tr.resultado AS resultado_tratamiento,
       (SELECT COUNT(*) FROM evidencia ev WHERE ev.id_transferencia = t.id_transferencia) AS n_evidencias
FROM transferencia t JOIN destino de ON de.id_destino = t.id_destino
JOIN tipo_destino td ON td.id_tipo_destino = de.id_tipo_destino
JOIN dispositivo d ON d.id_dispositivo = t.id_dispositivo
JOIN categoria cat ON cat.id_categoria = d.id_categoria
JOIN usuario u ON u.id_usuario = t.id_usuario_coordinador
LEFT JOIN tratamiento tr ON tr.id_transferencia = t.id_transferencia"""


@router.get("/transferencias")
def listar_transferencias(estado: Optional[str] = None, cn=Depends(get_db), u: dict = Depends(requiere(*PERSONAL))):
    cond, p = [], []
    if u["id_rol"] in ("REA", "BEN"):
        # Cada entidad externa ve solo lo que se le envió a su organización.
        cond.append("de.id_organizacion = ?"); p.append(u["id_organizacion"])
    if estado:
        cond.append("t.estado_cierre = ?"); p.append(estado)
    where = (" WHERE " + " AND ".join(cond)) if cond else ""
    return todos(cn, SQL_TRA + where + " ORDER BY t.fecha_transferencia DESC, t.id_transferencia DESC", *p)


@router.post("/transferencias", status_code=201)
def asignar_destino(d: Transferencia, cn=Depends(get_db), u: dict = Depends(requiere("COO"))):
    nuevo = siguiente_id(cn, "transferencia", "id_transferencia", "TR-")
    # RN-04 (compatibilidad clasificación-destino) la valida el trigger.
    ejecutar(cn, "EXEC sp_asignar_destino ?, ?, ?, ?", nuevo, d.id_dispositivo, d.id_destino, u["id_usuario"])
    return uno(cn, SQL_TRA + " WHERE t.id_transferencia = ?", nuevo)


@router.post("/transferencias/{id}/confirmar")
def confirmar_transferencia(id: str, cn=Depends(get_db), _: dict = Depends(requiere("COO", "REA", "BEN"))):
    ejecutar(cn, "EXEC sp_confirmar_transferencia ?", id)     # RN-08: exige evidencia de entrega
    return uno(cn, SQL_TRA + " WHERE t.id_transferencia = ?", id)


# ------------------------------------------------------------------ tratamientos
class Tratamiento(BaseModel):
    id_transferencia: str = Field(min_length=1, max_length=20)
    tipo_tratamiento: Literal["Reacondicionamiento", "Reciclaje", "Disposicion_controlada"]
    resultado: str = Field(min_length=5, max_length=300)


@router.get("/tratamientos")
def listar_tratamientos(cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    return todos(cn, """SELECT tr.*, t.id_dispositivo, de.nombre_entidad, u.nombres + ' ' + u.apellidos AS responsable
                        FROM tratamiento tr JOIN transferencia t ON t.id_transferencia = tr.id_transferencia
                        JOIN destino de ON de.id_destino = t.id_destino
                        JOIN usuario u ON u.id_usuario = tr.id_usuario_responsable
                        ORDER BY tr.fecha_tratamiento DESC""")


@router.post("/tratamientos", status_code=201)
def registrar_tratamiento(d: Tratamiento, cn=Depends(get_db), u: dict = Depends(requiere("REA"))):
    nuevo = siguiente_id(cn, "tratamiento", "id_tratamiento", "TRT-")
    ejecutar(cn, "EXEC sp_registrar_tratamiento ?, ?, ?, ?, ?", nuevo, d.id_transferencia, u["id_usuario"],
             d.tipo_tratamiento, d.resultado.strip())
    return uno(cn, "SELECT * FROM tratamiento WHERE id_tratamiento = ?", nuevo)
