"""Panel: indicadores (RF-INT-05), alertas de capacidad y auditoría."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import ejecutar, get_db, todos, uno
from ..seguridad import PERSONAL, requiere, usuario_actual

router = APIRouter(prefix="/api", tags=["Panel, alertas y auditoría"])


@router.get("/panel")
def resumen(cn=Depends(get_db), u: dict = Depends(usuario_actual)):
    if u["id_rol"] == "GEN":
        mios = todos(cn, """SELECT d.estado_actual, COUNT(*) AS n, SUM(d.peso_kg) AS kg
                            FROM dispositivo d JOIN lote l ON l.id_lote = d.id_lote JOIN solicitud s ON s.id_solicitud = l.id_solicitud
                            WHERE s.id_usuario_generador = ? GROUP BY d.estado_actual""", u["id_usuario"])
        return {"por_estado": mios,
                "solicitudes": uno(cn, "SELECT COUNT(*) AS n FROM solicitud WHERE id_usuario_generador = ?", u["id_usuario"])["n"]}
    k = uno(cn, """SELECT
        (SELECT COUNT(*) FROM dispositivo) AS total_dispositivos,
        (SELECT COUNT(*) FROM dispositivo WHERE id_centro_actual IS NOT NULL) AS en_inventario,
        (SELECT ISNULL(SUM(peso_kg), 0) FROM dispositivo) AS kg_totales,
        (SELECT ISNULL(SUM(d.peso_kg), 0) FROM dispositivo d WHERE EXISTS (SELECT 1 FROM historial h
             WHERE h.id_dispositivo = d.id_dispositivo AND h.estado_nuevo IN ('Asignado', 'Valorizado'))) AS kg_recuperados,
        (SELECT CAST(100.0 * SUM(CASE WHEN estado_actual = 'Cerrado' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) FROM dispositivo) AS trazabilidad_pct,
        (SELECT CAST(100.0 * SUM(ocupacion_actual_unidades) / SUM(capacidad_unidades) AS DECIMAL(5,1)) FROM centro) AS capacidad_usada_pct,
        (SELECT COUNT(*) FROM solicitud WHERE estado_solicitud = 'Pendiente') AS solicitudes_pendientes,
        (SELECT COUNT(*) FROM transferencia WHERE estado_cierre = 'Pendiente_Evidencia') AS transferencias_abiertas,
        (SELECT COUNT(*) FROM movimiento WHERE estado_movimiento = 'Abierto') AS movimientos_abiertos,
        (SELECT COUNT(*) FROM alerta WHERE estado_alerta = 'Abierta') AS alertas_abiertas""")
    k["por_estado"] = todos(cn, "SELECT estado_actual, COUNT(*) AS n, SUM(peso_kg) AS kg FROM dispositivo GROUP BY estado_actual")
    k["por_clasificacion"] = todos(cn, """SELECT cl.nombre_clasificacion, COUNT(*) AS n FROM dispositivo d
        CROSS APPLY (SELECT TOP 1 e.id_clasificacion FROM evaluacion e WHERE e.id_dispositivo = d.id_dispositivo
                     ORDER BY e.fecha_evaluacion DESC, e.id_evaluacion DESC) ult
        JOIN clasificacion cl ON cl.id_clasificacion = ult.id_clasificacion GROUP BY cl.nombre_clasificacion""")
    k["centros"] = todos(cn, """SELECT id_centro, nombre_centro, capacidad_unidades, ocupacion_actual_unidades,
        CAST(100.0 * ocupacion_actual_unidades / capacidad_unidades AS DECIMAL(5,1)) AS ocupacion_pct FROM centro ORDER BY nombre_centro""")
    k["cuellos_botella"] = todos(cn, """SELECT v.id_escenario, v.nombre_origen, v.nombre_destino, v.capacidad_kg, v.flujo_kg
        FROM vw_resultado_flujo v
        WHERE v.en_corte_minimo = 1 AND v.nro_ejecucion = (SELECT MAX(nro_ejecucion) FROM resultado r WHERE r.id_escenario = v.id_escenario)
          AND v.id_escenario = 'ESC-1' ORDER BY v.nro_arista""")
    k["ultimos_cambios"] = todos(cn, """SELECT TOP 6 h.id_dispositivo, h.estado_anterior, h.estado_nuevo, h.fecha_cambio, h.responsable
        FROM vw_trazabilidad h ORDER BY h.fecha_cambio DESC, h.nro_cambio DESC""")
    return k


@router.get("/indicadores")
def indicadores(periodo: Optional[str] = None, cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    if periodo:
        return todos(cn, "SELECT * FROM indicador WHERE periodo = ? ORDER BY nombre", periodo)
    return todos(cn, "SELECT * FROM indicador ORDER BY periodo DESC, nombre")


@router.post("/indicadores/calcular")
def calcular(periodo: str = Query(default_factory=lambda: date.today().strftime("%Y-%m"), pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
             cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    ejecutar(cn, "EXEC sp_calcular_indicadores ?", periodo)
    return todos(cn, "SELECT * FROM indicador WHERE periodo = ? ORDER BY nombre", periodo)


@router.get("/alertas")
def alertas(cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    return todos(cn, """SELECT a.*, c.nombre_centro FROM alerta a JOIN centro c ON c.id_centro = a.id_centro
                        ORDER BY CASE a.estado_alerta WHEN 'Abierta' THEN 0 ELSE 1 END, a.fecha DESC""")


@router.post("/alertas/{id}/atender")
def atender(id: int, cn=Depends(get_db), _: dict = Depends(requiere("OPE", "COO"))):
    if ejecutar(cn, "UPDATE alerta SET estado_alerta = 'Atendida' WHERE id_alerta = ? AND estado_alerta = 'Abierta'", id) == 0:
        raise HTTPException(404, "La alerta no existe o ya fue atendida.")
    return uno(cn, "SELECT * FROM alerta WHERE id_alerta = ?", id)


@router.get("/auditoria")
def auditoria(tabla: Optional[str] = None, limite: int = Query(200, ge=1, le=1000),
              cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):
    sql = """SELECT TOP (?) a.*, u.nombres + ' ' + u.apellidos AS usuario FROM auditoria a
             LEFT JOIN usuario u ON u.id_usuario = a.id_usuario"""
    if tabla:
        return todos(cn, sql + " WHERE a.tabla_afectada = ? ORDER BY a.id_auditoria DESC", limite, tabla)
    return todos(cn, sql + " ORDER BY a.id_auditoria DESC", limite)
