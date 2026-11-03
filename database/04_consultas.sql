/* =====================================================================
   EcoRAEE Cloud - Consultas del segundo avance
   Ejecutar después de 01_esquema.sql y 02_datos.sql.
   Usan JOIN, GROUP BY y subconsultas (marcadas con [JOIN], [GROUP BY], [SUBCONSULTA]).
   ===================================================================== */
SET NOCOUNT ON;
GO
USE EcoRaEE_CLOUD;
GO

/* ---------------------------------------------------------------------
   a) Historial de estados de un dispositivo.
      [JOIN] historial con usuario y rol para saber quién hizo cada cambio.
      Cambie @id para consultar otro equipo (DSP-001 recorre todo el ciclo).
   --------------------------------------------------------------------- */
DECLARE @id VARCHAR(20) = 'DSP-001';

SELECT h.nro_cambio,
       ISNULL(h.estado_anterior, '(registro)') AS estado_anterior,
       h.estado_nuevo,
       h.fecha_cambio,
       u.nombres + ' ' + u.apellidos AS responsable,
       r.nombre_rol AS rol_responsable
FROM historial h
JOIN usuario u ON u.id_usuario = h.id_usuario_responsable
JOIN rol r     ON r.id_rol = u.id_rol
WHERE h.id_dispositivo = @id
ORDER BY h.nro_cambio;
GO

/* ---------------------------------------------------------------------
   b) Inventario por centro y estado.
      [JOIN] centro con dispositivo, [GROUP BY] centro y estado.
      Solo cuenta los equipos que están físicamente en un centro.
   --------------------------------------------------------------------- */
SELECT c.nombre_centro,
       d.estado_actual,
       COUNT(*)       AS cantidad,
       SUM(d.peso_kg) AS peso_total_kg,
       c.capacidad_unidades
FROM centro c
JOIN dispositivo d ON d.id_centro_actual = c.id_centro
GROUP BY c.nombre_centro, d.estado_actual, c.capacidad_unidades
ORDER BY c.nombre_centro, d.estado_actual;
GO

/* ---------------------------------------------------------------------
   c) Dispositivos por categoría y clasificación técnica.
      [SUBCONSULTA] toma la evaluación MÁS RECIENTE de cada equipo
      (un equipo puede reevaluarse), [JOIN] con categoría y clasificación,
      [GROUP BY] categoría y clasificación. Los no evaluados salen como "Sin evaluar".
   --------------------------------------------------------------------- */
SELECT cat.nombre_categoria,
       ISNULL(cl.nombre_clasificacion, 'Sin evaluar') AS clasificacion_tecnica,
       COUNT(*)       AS cantidad,
       SUM(d.peso_kg) AS peso_total_kg
FROM dispositivo d
JOIN categoria cat ON cat.id_categoria = d.id_categoria
LEFT JOIN (SELECT e.id_dispositivo, e.id_clasificacion,
                  ROW_NUMBER() OVER (PARTITION BY e.id_dispositivo
                                     ORDER BY e.fecha_evaluacion DESC, e.id_evaluacion DESC) AS orden
           FROM evaluacion e) ult
       ON ult.id_dispositivo = d.id_dispositivo AND ult.orden = 1
LEFT JOIN clasificacion cl ON cl.id_clasificacion = ult.id_clasificacion
GROUP BY cat.nombre_categoria, ISNULL(cl.nombre_clasificacion, 'Sin evaluar')
ORDER BY cat.nombre_categoria, clasificacion_tecnica;
GO

/* ---------------------------------------------------------------------
   d) Porcentaje de dispositivos con la trazabilidad cerrada.
      [SUBCONSULTA] escalar para el total, [GROUP BY] para el detalle por
      clasificación técnica del equipo cerrado.
   --------------------------------------------------------------------- */
-- d.1 Porcentaje general
SELECT (SELECT COUNT(*) FROM dispositivo WHERE estado_actual = 'Cerrado') AS cerrados,
       (SELECT COUNT(*) FROM dispositivo)                                AS total,
       CAST(100.0 * (SELECT COUNT(*) FROM dispositivo WHERE estado_actual = 'Cerrado')
                  / (SELECT COUNT(*) FROM dispositivo) AS DECIMAL(5,2))  AS porcentaje_cerrado;

-- d.2 Detalle: cuántos cerrados hay de cada clasificación y qué % del total representan
SELECT cl.nombre_clasificacion,
       COUNT(*) AS cerrados,
       CAST(100.0 * COUNT(*) / (SELECT COUNT(*) FROM dispositivo) AS DECIMAL(5,2)) AS porcentaje_del_total
FROM dispositivo d
JOIN evaluacion e     ON e.id_dispositivo = d.id_dispositivo
JOIN clasificacion cl ON cl.id_clasificacion = e.id_clasificacion
WHERE d.estado_actual = 'Cerrado'
  AND e.fecha_evaluacion = (SELECT MAX(e2.fecha_evaluacion) FROM evaluacion e2
                            WHERE e2.id_dispositivo = d.id_dispositivo)
GROUP BY cl.nombre_clasificacion
ORDER BY cl.nombre_clasificacion;
GO

/* ---------------------------------------------------------------------
   e) Dispositivos recibidos que aún no tienen evaluación técnica.
      [JOIN] dispositivo, lote, recepción y centro;
      [SUBCONSULTA] NOT EXISTS sobre evaluación.
      "Recibido" = la solicitud de su lote tiene una recepción registrada.
   --------------------------------------------------------------------- */
SELECT d.id_dispositivo,
       cat.nombre_categoria,
       d.peso_kg,
       d.estado_actual,
       c.nombre_centro,
       rc.fecha_recepcion,
       DATEDIFF(DAY, rc.fecha_recepcion, SYSDATETIME()) AS dias_sin_evaluar
FROM dispositivo d
JOIN lote l       ON l.id_lote = d.id_lote
JOIN recepcion rc  ON rc.id_solicitud = l.id_solicitud
JOIN categoria cat ON cat.id_categoria = d.id_categoria
LEFT JOIN centro c ON c.id_centro = d.id_centro_actual
WHERE NOT EXISTS (SELECT 1 FROM evaluacion e WHERE e.id_dispositivo = d.id_dispositivo)
ORDER BY rc.fecha_recepcion, d.id_dispositivo;
GO
