"""Dispositivos: registro, consulta, edición, trazabilidad completa y cierre."""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import ejecutar, get_db, siguiente_id, todos, uno
from ..seguridad import requiere, usuario_actual

router = APIRouter(prefix="/api/dispositivos", tags=["Dispositivos y trazabilidad"])

ESTADOS = ["Registrado", "Recolectado", "Evaluado", "Reacondicionamiento", "Asignado",
           "Reciclaje", "Valorizado", "Disposicion", "Cerrado"]


class DispositivoNuevo(BaseModel):
    id_categoria: str = Field(min_length=1, max_length=20)
    id_marca: str = Field(min_length=1, max_length=20)
    numero_serie: Optional[str] = Field(None, max_length=100, pattern=r"^[A-Za-z0-9\-_/\.]*$")
    modelo: Optional[str] = Field(None, max_length=100)
    peso_kg: Decimal = Field(gt=0, le=500, max_digits=8, decimal_places=2)


class DispositivoEditar(DispositivoNuevo):
    pass


class Ubicacion(BaseModel):
    ubicacion_centro: str = Field(min_length=1, max_length=30)


def insertar_dispositivo(cn, id_lote: str, d: DispositivoNuevo) -> str:
    nuevo = siguiente_id(cn, "dispositivo", "id_dispositivo", "DSP-")
    qr = "QR-ECO-" + nuevo.split("-")[1]
    # El trigger tr_dispositivo_registro crea el primer registro del historial (RN-01).
    ejecutar(cn, """INSERT INTO dispositivo (id_dispositivo, id_categoria, id_marca, id_lote, numero_serie, modelo, codigo_qr, peso_kg)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
             nuevo, d.id_categoria, d.id_marca, id_lote, (d.numero_serie or "").strip() or None,
             (d.modelo or "").strip() or None, qr, d.peso_kg)
    return nuevo


SQL_DISP = """SELECT d.id_dispositivo, d.codigo_qr, d.numero_serie, d.modelo, d.peso_kg, d.estado_actual,
       d.fecha_registro, d.id_categoria, cat.nombre_categoria, d.id_marca, m.nombre_marca,
       d.id_lote, l.codigo_lote, l.id_solicitud, s.id_usuario_generador, s.estado_solicitud,
       d.id_centro_actual, c.nombre_centro, d.ubicacion_centro, d.fecha_ingreso_centro,
       (SELECT TOP 1 cl.nombre_clasificacion FROM evaluacion e JOIN clasificacion cl ON cl.id_clasificacion = e.id_clasificacion
         WHERE e.id_dispositivo = d.id_dispositivo ORDER BY e.fecha_evaluacion DESC, e.id_evaluacion DESC) AS clasificacion
FROM dispositivo d
JOIN categoria cat ON cat.id_categoria = d.id_categoria
JOIN marca m ON m.id_marca = d.id_marca
JOIN lote l ON l.id_lote = d.id_lote
JOIN solicitud s ON s.id_solicitud = l.id_solicitud
LEFT JOIN centro c ON c.id_centro = d.id_centro_actual"""


def obtener(cn, id: str, u: dict) -> dict:
    d = uno(cn, SQL_DISP + " WHERE d.id_dispositivo = ? OR d.codigo_qr = ?", id, id)
    if not d:
        raise HTTPException(404, "Dispositivo no encontrado.")
    if u["id_rol"] == "GEN" and d["id_usuario_generador"] != u["id_usuario"]:
        raise HTTPException(403, "Solo puede ver los equipos que usted entregó.")
    return d


@router.get("")
def listar(estado: Optional[str] = None, centro: Optional[str] = None, categoria: Optional[str] = None,
           clasificacion: Optional[str] = None, q: Optional[str] = None,
           cn=Depends(get_db), u: dict = Depends(usuario_actual)):
    cond, p = [], []
    if u["id_rol"] == "GEN":
        cond.append("s.id_usuario_generador = ?"); p.append(u["id_usuario"])
    if estado:
        cond.append("d.estado_actual = ?"); p.append(estado)
    if centro:
        cond.append("d.id_centro_actual = ?"); p.append(centro)
    if categoria:
        cond.append("d.id_categoria = ?"); p.append(categoria)
    if q:
        cond.append("(d.id_dispositivo LIKE ? OR d.codigo_qr LIKE ? OR d.numero_serie LIKE ? OR d.modelo LIKE ?)")
        p += [f"%{q.strip()}%"] * 4
    sql = SQL_DISP + ((" WHERE " + " AND ".join(cond)) if cond else "")
    filas = todos(cn, f"SELECT * FROM ({sql}) x" + (" WHERE x.clasificacion = ?" if clasificacion else "")
                  + " ORDER BY x.id_dispositivo", *p, *([clasificacion] if clasificacion else []))
    return filas


@router.get("/estados")
def estados(_: dict = Depends(usuario_actual)):
    return ESTADOS


@router.get("/{id}")
def ver(id: str, cn=Depends(get_db), u: dict = Depends(usuario_actual)):
    d = obtener(cn, id, u)
    i = d["id_dispositivo"]
    d["historial"] = todos(cn, "SELECT * FROM vw_trazabilidad WHERE id_dispositivo = ? ORDER BY nro_cambio", i)
    d["evaluaciones"] = todos(cn, """SELECT e.id_evaluacion, e.fecha_evaluacion, e.diagnostico, co.nombre_condicion,
                                            cl.nombre_clasificacion, u.nombres + ' ' + u.apellidos AS tecnico
                                     FROM evaluacion e JOIN condicion co ON co.id_condicion = e.id_condicion
                                     JOIN clasificacion cl ON cl.id_clasificacion = e.id_clasificacion
                                     JOIN usuario u ON u.id_usuario = e.id_usuario_tecnico
                                     WHERE e.id_dispositivo = ? ORDER BY e.fecha_evaluacion""", i)
    d["movimientos"] = todos(cn, """SELECT mv.id_movimiento, co.nombre_centro AS origen, cd.nombre_centro AS destino,
                                           mv.fecha_salida, mv.fecha_recepcion, mv.estado_movimiento
                                    FROM movimiento mv JOIN centro co ON co.id_centro = mv.id_centro_origen
                                    JOIN centro cd ON cd.id_centro = mv.id_centro_destino
                                    WHERE mv.id_dispositivo = ? ORDER BY mv.fecha_salida""", i)
    d["transferencias"] = todos(cn, """SELECT t.id_transferencia, de.nombre_entidad, td.nombre_tipo, t.fecha_transferencia,
                                              t.estado_cierre, t.fecha_confirmacion_cierre,
                                              tr.tipo_tratamiento, tr.resultado AS resultado_tratamiento
                                       FROM transferencia t JOIN destino de ON de.id_destino = t.id_destino
                                       JOIN tipo_destino td ON td.id_tipo_destino = de.id_tipo_destino
                                       LEFT JOIN tratamiento tr ON tr.id_transferencia = t.id_transferencia
                                       WHERE t.id_dispositivo = ? ORDER BY t.fecha_transferencia""", i)
    if u["id_rol"] != "GEN":
        d["evidencias"] = todos(cn, """SELECT ev.id_evidencia, ev.tipo_documento, ev.nivel_acceso, ev.fecha_carga,
                                             ev.id_transferencia, ev.id_evaluacion, ev.id_movimiento
                                      FROM evidencia ev
                                      WHERE ev.id_evaluacion IN (SELECT id_evaluacion FROM evaluacion WHERE id_dispositivo = ?)
                                         OR ev.id_movimiento IN (SELECT id_movimiento FROM movimiento WHERE id_dispositivo = ?)
                                         OR ev.id_transferencia IN (SELECT id_transferencia FROM transferencia WHERE id_dispositivo = ?)
                                      ORDER BY ev.fecha_carga""", i, i, i)
    return d


@router.put("/{id}")
def actualizar(id: str, d: DispositivoEditar, cn=Depends(get_db), u: dict = Depends(requiere("GEN", "OPE"))):
    actual = obtener(cn, id, u)
    if actual["estado_actual"] != "Registrado":
        raise HTTPException(409, "Solo se editan los datos de un equipo en estado Registrado (antes de recolectarlo).")
    if u["id_rol"] == "GEN" and actual["id_usuario_generador"] != u["id_usuario"]:
        raise HTTPException(403, "Solo el generador puede editar su equipo.")
    ejecutar(cn, """UPDATE dispositivo SET id_categoria = ?, id_marca = ?, numero_serie = ?, modelo = ?, peso_kg = ?
                    WHERE id_dispositivo = ? AND estado_actual = 'Registrado'""",
             d.id_categoria, d.id_marca, (d.numero_serie or "").strip() or None, (d.modelo or "").strip() or None,
             d.peso_kg, actual["id_dispositivo"])
    return obtener(cn, actual["id_dispositivo"], u)


@router.patch("/{id}/ubicacion")
def cambiar_ubicacion(id: str, d: Ubicacion, cn=Depends(get_db), u: dict = Depends(requiere("OPE", "COO"))):
    actual = obtener(cn, id, u)
    if not actual["id_centro_actual"]:
        raise HTTPException(409, "El equipo no está en un centro.")
    ejecutar(cn, "UPDATE dispositivo SET ubicacion_centro = ? WHERE id_dispositivo = ?",
             d.ubicacion_centro.strip(), actual["id_dispositivo"])
    return obtener(cn, actual["id_dispositivo"], u)


@router.post("/{id}/cerrar")
def cerrar_trazabilidad(id: str, cn=Depends(get_db), u: dict = Depends(requiere("COO"))):
    actual = obtener(cn, id, u)
    ejecutar(cn, "EXEC sp_cerrar_trazabilidad ?, ?", actual["id_dispositivo"], u["id_usuario"])   # RN-08
    return obtener(cn, actual["id_dispositivo"], u)
