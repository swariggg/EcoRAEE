"""Solicitudes de entrega, lotes, recolección y recepción en el centro."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import ejecutar, get_db, siguiente_id, todos, transaccion, uno
from ..seguridad import requiere, usuario_actual
from .dispositivos import DispositivoNuevo, insertar_dispositivo

router = APIRouter(prefix="/api/solicitudes", tags=["Solicitudes, lotes y recepción"])

SQL_SOL = """SELECT s.id_solicitud, s.fecha_solicitud, s.estado_solicitud, s.id_usuario_generador,
       u.nombres + ' ' + u.apellidos AS generador, o.nombre AS organizacion,
       s.id_centro_destino, c.nombre_centro,
       (SELECT COUNT(*) FROM dispositivo d JOIN lote l ON l.id_lote = d.id_lote WHERE l.id_solicitud = s.id_solicitud) AS n_dispositivos,
       (SELECT ISNULL(SUM(d.peso_kg), 0) FROM dispositivo d JOIN lote l ON l.id_lote = d.id_lote WHERE l.id_solicitud = s.id_solicitud) AS peso_total_kg,
       rc.fecha_programada, rc.fecha_realizada, rc.id_usuario_operador AS operador_recoleccion
FROM solicitud s
JOIN usuario u ON u.id_usuario = s.id_usuario_generador
JOIN organizacion o ON o.id_organizacion = u.id_organizacion
JOIN centro c ON c.id_centro = s.id_centro_destino
LEFT JOIN recoleccion rc ON rc.id_solicitud = s.id_solicitud"""


class SolicitudNueva(BaseModel):
    id_centro_destino: str = Field(min_length=1, max_length=20)
    id_usuario_generador: Optional[str] = Field(None, max_length=20, description="Solo el administrador lo indica")
    dispositivos: list[DispositivoNuevo] = Field(default_factory=list, max_length=200)


class SolicitudEditar(BaseModel):
    id_centro_destino: str = Field(min_length=1, max_length=20)


class Recoleccion(BaseModel):
    id_usuario_operador: str = Field(min_length=1, max_length=20)
    fecha_programada: datetime


class Recepcion(BaseModel):
    ubicacion: str = Field(min_length=1, max_length=30)


def obtener_solicitud(cn, id: str, u: dict) -> dict:
    s = uno(cn, SQL_SOL + " WHERE s.id_solicitud = ?", id)
    if not s:
        raise HTTPException(404, "Solicitud no encontrada.")
    if u["id_rol"] == "GEN" and s["id_usuario_generador"] != u["id_usuario"]:
        raise HTTPException(403, "Solo puede ver sus propias solicitudes.")
    return s


def _pendiente_y_propia(s: dict, u: dict):
    if s["estado_solicitud"] != "Pendiente":
        raise HTTPException(409, "Solo se puede modificar una solicitud Pendiente.")
    if u["id_rol"] not in ("ADM", "OPE") and s["id_usuario_generador"] != u["id_usuario"]:
        raise HTTPException(403, "Solo el generador de la solicitud puede modificarla.")


@router.get("")
def listar(estado: Optional[str] = None, cn=Depends(get_db), u: dict = Depends(usuario_actual)):
    cond, p = [], []
    if u["id_rol"] == "GEN":
        cond.append("s.id_usuario_generador = ?"); p.append(u["id_usuario"])
    if estado:
        cond.append("s.estado_solicitud = ?"); p.append(estado)
    where = (" WHERE " + " AND ".join(cond)) if cond else ""
    return todos(cn, SQL_SOL + where + " ORDER BY s.fecha_solicitud DESC, s.id_solicitud DESC", *p)


@router.get("/{id}")
def ver(id: str, cn=Depends(get_db), u: dict = Depends(usuario_actual)):
    s = obtener_solicitud(cn, id, u)
    s["lotes"] = todos(cn, """SELECT l.id_lote, l.codigo_lote, l.fecha_creacion,
                                     (SELECT COUNT(*) FROM dispositivo d WHERE d.id_lote = l.id_lote) AS n_dispositivos
                              FROM lote l WHERE l.id_solicitud = ? ORDER BY l.id_lote""", id)
    s["dispositivos"] = todos(cn, """SELECT d.id_dispositivo, d.id_lote, cat.nombre_categoria, m.nombre_marca, d.modelo,
                                            d.numero_serie, d.codigo_qr, d.peso_kg, d.estado_actual
                                     FROM dispositivo d JOIN lote l ON l.id_lote = d.id_lote
                                     JOIN categoria cat ON cat.id_categoria = d.id_categoria
                                     JOIN marca m ON m.id_marca = d.id_marca
                                     WHERE l.id_solicitud = ? ORDER BY d.id_dispositivo""", id)
    s["recepcion"] = uno(cn, """SELECT r.*, u.nombres + ' ' + u.apellidos AS operador FROM recepcion r
                                JOIN usuario u ON u.id_usuario = r.id_usuario_operador WHERE r.id_solicitud = ?""", id)
    return s


@router.post("", status_code=201)
def crear(d: SolicitudNueva, cn=Depends(get_db), u: dict = Depends(requiere("GEN", "OPE"))):
    generador = u["id_usuario"]
    if u["id_rol"] in ("ADM", "OPE") and d.id_usuario_generador:
        generador = d.id_usuario_generador
    g = uno(cn, "SELECT id_rol, activo FROM usuario WHERE id_usuario = ?", generador)
    if not g or not g["activo"]:
        raise HTTPException(400, "El generador no existe o está inactivo.")
    with transaccion(cn):
        id_sol = siguiente_id(cn, "solicitud", "id_solicitud", "S-")
        ejecutar(cn, "INSERT INTO solicitud (id_solicitud, id_usuario_generador, id_centro_destino) VALUES (?, ?, ?)",
                 id_sol, generador, d.id_centro_destino)
        id_lote = crear_lote(cn, id_sol)
        for disp in d.dispositivos:
            insertar_dispositivo(cn, id_lote, disp)
    return ver(id_sol, cn, u)


def crear_lote(cn, id_solicitud: str) -> str:
    id_lote = siguiente_id(cn, "lote", "id_lote", "L-")
    codigo = siguiente_id(cn, "lote", "codigo_lote", f"LOTE-{date.today().year}-")
    ejecutar(cn, "INSERT INTO lote (id_lote, id_solicitud, codigo_lote) VALUES (?, ?, ?)", id_lote, id_solicitud, codigo)
    return id_lote


@router.put("/{id}")
def actualizar(id: str, d: SolicitudEditar, cn=Depends(get_db), u: dict = Depends(requiere("GEN", "OPE"))):
    s = obtener_solicitud(cn, id, u)
    _pendiente_y_propia(s, u)
    ejecutar(cn, "UPDATE solicitud SET id_centro_destino = ? WHERE id_solicitud = ? AND estado_solicitud = 'Pendiente'",
             d.id_centro_destino, id)
    return ver(id, cn, u)


@router.delete("/{id}")
def cancelar(id: str, cn=Depends(get_db), u: dict = Depends(requiere("GEN", "OPE"))):
    """Eliminación lógica: la solicitud pasa a Cancelada (sus equipos quedan registrados
    con historial, que por RN-01 no se puede borrar)."""
    s = obtener_solicitud(cn, id, u)
    _pendiente_y_propia(s, u)
    ejecutar(cn, "UPDATE solicitud SET estado_solicitud = 'Cancelada' WHERE id_solicitud = ?", id)
    ejecutar(cn, "INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario) VALUES ('solicitud', 'CANCELAR', ?, ?)",
             f"Solicitud {id} cancelada", u["id_usuario"])
    return {"id_solicitud": id, "estado_solicitud": "Cancelada"}


# ---------------------------------------------------------------- lotes
@router.post("/{id}/lotes", status_code=201)
def nuevo_lote(id: str, cn=Depends(get_db), u: dict = Depends(requiere("GEN", "OPE"))):
    s = obtener_solicitud(cn, id, u)
    _pendiente_y_propia(s, u)
    id_lote = crear_lote(cn, id)
    return uno(cn, "SELECT * FROM lote WHERE id_lote = ?", id_lote)


@router.delete("/{id}/lotes/{id_lote}", status_code=204)
def eliminar_lote(id: str, id_lote: str, cn=Depends(get_db), u: dict = Depends(requiere("GEN", "OPE"))):
    s = obtener_solicitud(cn, id, u)
    _pendiente_y_propia(s, u)
    # Un lote con dispositivos no se puede borrar (FK) -> 409.
    if ejecutar(cn, "DELETE FROM lote WHERE id_lote = ? AND id_solicitud = ?", id_lote, id) == 0:
        raise HTTPException(404, "Lote no encontrado en esta solicitud.")


@router.post("/{id}/dispositivos", status_code=201)
def agregar_dispositivo(id: str, d: DispositivoNuevo, id_lote: Optional[str] = None,
                        cn=Depends(get_db), u: dict = Depends(requiere("GEN", "OPE"))):
    s = obtener_solicitud(cn, id, u)
    _pendiente_y_propia(s, u)
    if not id_lote:
        ultimo = uno(cn, "SELECT TOP 1 id_lote FROM lote WHERE id_solicitud = ? ORDER BY id_lote DESC", id)
        id_lote = ultimo["id_lote"] if ultimo else crear_lote(cn, id)
    elif not uno(cn, "SELECT 1 AS x FROM lote WHERE id_lote = ? AND id_solicitud = ?", id_lote, id):
        raise HTTPException(400, "El lote no pertenece a la solicitud.")
    with transaccion(cn):
        nuevo = insertar_dispositivo(cn, id_lote, d)
    return uno(cn, "SELECT * FROM dispositivo WHERE id_dispositivo = ?", nuevo)


# ---------------------------------------------------------------- recolección
@router.put("/{id}/recoleccion")
def programar_recoleccion(id: str, d: Recoleccion, cn=Depends(get_db), u: dict = Depends(requiere("OPE", "COO"))):
    s = obtener_solicitud(cn, id, u)
    if s["estado_solicitud"] != "Pendiente":
        raise HTTPException(409, "Solo se programa la recolección de solicitudes Pendientes.")
    op = uno(cn, "SELECT id_rol, activo FROM usuario WHERE id_usuario = ?", d.id_usuario_operador)
    if not op or op["id_rol"] != "OPE" or not op["activo"]:
        raise HTTPException(400, "El responsable debe ser un operador de centro activo.")
    if d.fecha_programada.date() < date.today():
        raise HTTPException(422, "La fecha programada no puede estar en el pasado.")
    existe = uno(cn, "SELECT id_recoleccion FROM recoleccion WHERE id_solicitud = ?", id)
    if existe:
        ejecutar(cn, "UPDATE recoleccion SET id_usuario_operador = ?, fecha_programada = ? WHERE id_solicitud = ?",
                 d.id_usuario_operador, d.fecha_programada, id)
    else:
        nuevo = siguiente_id(cn, "recoleccion", "id_recoleccion", "R-")
        ejecutar(cn, """INSERT INTO recoleccion (id_recoleccion, id_solicitud, id_usuario_operador, fecha_programada)
                        VALUES (?, ?, ?, ?)""", nuevo, id, d.id_usuario_operador, d.fecha_programada)
    return uno(cn, "SELECT * FROM recoleccion WHERE id_solicitud = ?", id)


@router.delete("/{id}/recoleccion", status_code=204)
def cancelar_recoleccion(id: str, cn=Depends(get_db), u: dict = Depends(requiere("OPE", "COO"))):
    obtener_solicitud(cn, id, u)
    if ejecutar(cn, "DELETE FROM recoleccion WHERE id_solicitud = ? AND fecha_realizada IS NULL", id) == 0:
        raise HTTPException(404, "No hay una recolección pendiente para esta solicitud.")


# ---------------------------------------------------------------- recepción (sp_recibir_solicitud)
@router.post("/{id}/recibir")
def recibir(id: str, d: Recepcion, cn=Depends(get_db), u: dict = Depends(requiere("OPE"))):
    obtener_solicitud(cn, id, u)
    id_rec = siguiente_id(cn, "recepcion", "id_recepcion", "REC-")
    # El procedimiento es atómico: si el centro no tiene espacio, el CHECK revierte todo (RN-06).
    ejecutar(cn, "EXEC sp_recibir_solicitud ?, ?, ?, ?", id_rec, id, u["id_usuario"], d.ubicacion.strip())
    return ver(id, cn, u)
