/* =====================================================================
   EcoRAEE Cloud - Pruebas de reglas de negocio y transacciones
   Ejecutar después de 01_esquema.sql y 02_datos.sql.
   Cada prueba imprime OK si el resultado es el esperado.
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
USE EcoRaEE_CLOUD;
GO
IF OBJECT_ID('tempdb..#resultado_pruebas') IS NOT NULL DROP TABLE #resultado_pruebas;
CREATE TABLE #resultado_pruebas (id_prueba VARCHAR(20), descripcion VARCHAR(200), estado VARCHAR(10), detalle VARCHAR(400));
GO

/* CP-02: no se permiten dispositivos duplicados (código QR único). */
BEGIN TRY
    INSERT INTO dispositivo (id_dispositivo, id_categoria, id_marca, id_lote, codigo_qr, peso_kg)
    VALUES ('DSP-999', 'CAT-LAP', 'M-HP', 'L-004', 'QR-ECO-001', 2.0);
    INSERT INTO #resultado_pruebas VALUES ('CP-02', 'Registro duplicado', 'FALLA', 'Se aceptó un QR repetido');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('CP-02', 'Registro duplicado', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* CP-03: transición inválida (Recolectado -> Cerrado). */
BEGIN TRY
    EXEC sp_set_session_context 'id_usuario', 'U-COO1';
    UPDATE dispositivo SET estado_actual = 'Cerrado' WHERE id_dispositivo = 'DSP-031';
    INSERT INTO #resultado_pruebas VALUES ('CP-03', 'Transición inválida', 'FALLA', 'Se aceptó Recolectado -> Cerrado');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('CP-03', 'Transición inválida', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* RN-01: el historial no se puede borrar. */
BEGIN TRY
    DELETE FROM historial WHERE id_dispositivo = 'DSP-001';
    INSERT INTO #resultado_pruebas VALUES ('RN-01', 'Historial inmutable', 'FALLA', 'Se borró el historial');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-01', 'Historial inmutable', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* RN-02: un técnico inactivo no puede evaluar. */
BEGIN TRY
    EXEC sp_registrar_evaluacion 'EV-999', 'DSP-031', 'U-TEC2', 'CON-FUN', 'CL-REU', 'Prueba';
    INSERT INTO #resultado_pruebas VALUES ('RN-02', 'Técnico no autorizado', 'FALLA', 'Se aceptó la evaluación');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-02', 'Técnico no autorizado', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* RN-02 (bis): un coordinador tampoco puede evaluar. */
BEGIN TRY
    EXEC sp_registrar_evaluacion 'EV-998', 'DSP-031', 'U-COO1', 'CON-FUN', 'CL-REU', 'Prueba';
    INSERT INTO #resultado_pruebas VALUES ('RN-02b', 'Rol distinto a técnico', 'FALLA', 'Se aceptó la evaluación');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-02b', 'Rol distinto a técnico', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* RN-04: un equipo No recuperable (DSP-009) no puede ir a un beneficiario ni a un reacondicionador. */
BEGIN TRY
    EXEC sp_asignar_destino 'TR-990', 'DSP-009', 'D-TAL', 'U-COO1';
    INSERT INTO #resultado_pruebas VALUES ('RN-04', 'No recuperable a reacondicionador', 'FALLA', 'Se aceptó la transferencia');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-04', 'No recuperable a reacondicionador', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* RN-04 (bis): un equipo SIN evaluación (DSP-031) no puede asignarse. Antes era un hueco. */
BEGIN TRY
    EXEC sp_asignar_destino 'TR-991', 'DSP-031', 'D-FUN', 'U-COO1';
    INSERT INTO #resultado_pruebas VALUES ('RN-04b', 'Sin evaluación a beneficiario', 'FALLA', 'Se aceptó la transferencia');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-04b', 'Sin evaluación a beneficiario', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* Ciclo: un Reutilizable (DSP-010) no puede saltarse el reacondicionamiento (Evaluado -> Asignado). */
BEGIN TRY
    EXEC sp_asignar_destino 'TR-992', 'DSP-010', 'D-FUN', 'U-COO1';
    INSERT INTO #resultado_pruebas VALUES ('CP-03b', 'Beneficiario sin reacondicionar', 'FALLA', 'Se aceptó la transferencia');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('CP-03b', 'Beneficiario sin reacondicionar', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* RN-08: no se confirma una transferencia sin evidencia, ni se cierra la trazabilidad sin confirmación. */
EXEC sp_asignar_destino 'TR-010', 'DSP-010', 'D-TAL', 'U-COO1';   -- válida
BEGIN TRY
    EXEC sp_confirmar_transferencia 'TR-010';
    INSERT INTO #resultado_pruebas VALUES ('RN-08', 'Cierre sin evidencia', 'FALLA', 'Se cerró sin evidencia');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-08', 'Cierre sin evidencia', 'OK', ERROR_MESSAGE());
END CATCH;
GO
BEGIN TRY
    EXEC sp_cerrar_trazabilidad 'DSP-010', 'U-COO1';
    INSERT INTO #resultado_pruebas VALUES ('RN-08b', 'Cierre sin destino final', 'FALLA', 'Se cerró la trazabilidad');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-08b', 'Cierre sin destino final', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* Un equipo no puede tener dos transferencias abiertas. */
BEGIN TRY
    INSERT INTO transferencia (id_transferencia, id_dispositivo, id_destino, id_usuario_coordinador)
    VALUES ('TR-993', 'DSP-010', 'D-TAL', 'U-COO1');
    INSERT INTO #resultado_pruebas VALUES ('TR-UNICA', 'Dos transferencias abiertas', 'FALLA', 'Se aceptó la segunda');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('TR-UNICA', 'Dos transferencias abiertas', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* RN-03: un movimiento no se cierra sin evidencia. */
EXEC sp_mover_dispositivo 'MOV-100', 'DSP-012', 'C-LAB', 'Mesa 2', 'U-COO1';
BEGIN TRY
    EXEC sp_cerrar_movimiento 'MOV-100';
    INSERT INTO #resultado_pruebas VALUES ('RN-03', 'Movimiento sin evidencia', 'FALLA', 'Se cerró sin evidencia');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-03', 'Movimiento sin evidencia', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* CP-05 / RN-06: transferencia que falla a mitad -> ROLLBACK completo.
   El Acopio Sur tiene capacidad 10. Se mueven 10 equipos y el 11.º debe fallar
   sin dejar el inventario inconsistente (el origen NO debe perder la unidad). */
DECLARE @i INT = 13, @mv VARCHAR(20), @id VARCHAR(20);
WHILE @i <= 22
BEGIN
    SET @mv = 'MOV-' + CAST(200 + @i AS VARCHAR(3));
    SET @id = 'DSP-0' + CAST(@i AS VARCHAR(2));
    EXEC sp_mover_dispositivo @mv, @id, 'C-SUR', 'Estante S', 'U-COO1';
    SET @i += 1;
END;
GO
DECLARE @antes_nor INT = (SELECT ocupacion_actual_unidades FROM centro WHERE id_centro = 'C-NOR');
BEGIN TRY
    EXEC sp_mover_dispositivo 'MOV-299', 'DSP-023', 'C-SUR', 'Estante S', 'U-COO1';
    INSERT INTO #resultado_pruebas VALUES ('CP-05', 'Rollback por centro lleno', 'FALLA', 'Se superó la capacidad');
END TRY
BEGIN CATCH
    DECLARE @despues_nor INT = (SELECT ocupacion_actual_unidades FROM centro WHERE id_centro = 'C-NOR');
    DECLARE @centro_eq VARCHAR(20) = (SELECT id_centro_actual FROM dispositivo WHERE id_dispositivo = 'DSP-023');
    INSERT INTO #resultado_pruebas VALUES ('CP-05', 'Rollback por centro lleno',
        CASE WHEN @antes_nor = @despues_nor AND @centro_eq = 'C-NOR'
              AND NOT EXISTS (SELECT 1 FROM movimiento WHERE id_movimiento = 'MOV-299') THEN 'OK' ELSE 'FALLA' END,
        'Origen antes=' + CAST(@antes_nor AS VARCHAR(5)) + ' después=' + CAST(@despues_nor AS VARCHAR(5))
        + ', equipo sigue en ' + @centro_eq + '. ' + ERROR_MESSAGE());
END CATCH;
GO

/* Dato derivado coherente: ocupación guardada = ocupación real en todos los centros. */
INSERT INTO #resultado_pruebas
SELECT 'DERIVADO', 'Ocupación guardada = real',
       CASE WHEN NOT EXISTS (SELECT 1 FROM vw_ocupacion_centro WHERE ocupacion_guardada <> ocupacion_real) THEN 'OK' ELSE 'FALLA' END,
       'Revisa vw_ocupacion_centro';
GO

/* CP-07: el flujo máximo guardado por 02_datos.sql coincide con el cálculo a mano (140 kg).
   CP-08: la suma de capacidades del corte mínimo es igual al flujo máximo en los 5 escenarios. */
INSERT INTO #resultado_pruebas
SELECT 'CP-07', 'Flujo máximo ESC-1 = 140 kg',
       CASE WHEN flujo_maximo_kg = 140 THEN 'OK' ELSE 'FALLA' END,
       'Flujo guardado = ' + CAST(flujo_maximo_kg AS VARCHAR(20))
FROM resultado WHERE id_escenario = 'ESC-1' AND nro_ejecucion = 1;

INSERT INTO #resultado_pruebas
SELECT 'CP-08', 'Corte mínimo = flujo máximo',
       CASE WHEN COUNT(*) = 5 AND SUM(CASE WHEN x.corte = x.flujo_maximo_kg THEN 1 ELSE 0 END) = 5 THEN 'OK' ELSE 'FALLA' END,
       'Escenarios donde corte = flujo: ' + CAST(SUM(CASE WHEN x.corte = x.flujo_maximo_kg THEN 1 ELSE 0 END) AS VARCHAR(5)) + ' de 5'
FROM (SELECT id_escenario, nro_ejecucion, flujo_maximo_kg, SUM(CASE WHEN en_corte_minimo = 1 THEN capacidad_kg ELSE 0 END) AS corte
      FROM vw_resultado_flujo GROUP BY id_escenario, nro_ejecucion, flujo_maximo_kg) x;
GO

/* RN-05: no se puede guardar un flujo mayor que la capacidad de la arista. */
BEGIN TRY
    EXEC sp_guardar_resultado_flujo 'ESC-1', 999, N'[{"nro_arista":1,"flujo_kg":999,"en_corte_minimo":0}]';
    INSERT INTO #resultado_pruebas VALUES ('RN-05', 'Flujo > capacidad', 'FALLA', 'Se guardó el flujo');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('RN-05', 'Flujo > capacidad', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* =====================================================================
   RECHAZOS DEL MOTOR: restricciones de integridad (PK, FK, UNIQUE, CHECK
   y borrado de un registro con hijos). La de UNIQUE es CP-02, al inicio.
   ===================================================================== */

/* INT-PK: clave primaria repetida (el rol 'TEC' ya existe). */
BEGIN TRY
    INSERT INTO rol (id_rol, nombre_rol) VALUES ('TEC', 'Otro técnico');
    INSERT INTO #resultado_pruebas VALUES ('INT-PK', 'PK repetida', 'FALLA', 'Se aceptó una PK duplicada');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('INT-PK', 'PK repetida', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* INT-FK: clave foránea inexistente (la categoría 'CAT-XXX' no existe). */
BEGIN TRY
    INSERT INTO dispositivo (id_dispositivo, id_categoria, id_marca, id_lote, codigo_qr, peso_kg)
    VALUES ('DSP-998', 'CAT-XXX', 'M-HP', 'L-004', 'QR-ECO-998', 1.0);
    INSERT INTO #resultado_pruebas VALUES ('INT-FK', 'FK inexistente', 'FALLA', 'Se aceptó una categoría que no existe');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('INT-FK', 'FK inexistente', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* INT-CHECK: CHECK incumplido (el peso debe ser mayor que 0). */
BEGIN TRY
    INSERT INTO dispositivo (id_dispositivo, id_categoria, id_marca, id_lote, codigo_qr, peso_kg)
    VALUES ('DSP-997', 'CAT-LAP', 'M-HP', 'L-004', 'QR-ECO-997', -2.5);
    INSERT INTO #resultado_pruebas VALUES ('INT-CHECK', 'CHECK incumplido', 'FALLA', 'Se aceptó un peso negativo');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('INT-CHECK', 'CHECK incumplido', 'OK', ERROR_MESSAGE());
END CATCH;
GO

/* INT-DEL: borrar un registro con hijos (la categoría Laptop tiene dispositivos). */
BEGIN TRY
    DELETE FROM categoria WHERE id_categoria = 'CAT-LAP';
    INSERT INTO #resultado_pruebas VALUES ('INT-DEL', 'Borrado con hijos', 'FALLA', 'Se borró una categoría con dispositivos');
END TRY
BEGIN CATCH
    INSERT INTO #resultado_pruebas VALUES ('INT-DEL', 'Borrado con hijos', 'OK', ERROR_MESSAGE());
END CATCH;
GO

SELECT id_prueba, descripcion, estado, LEFT(detalle, 120) AS detalle FROM #resultado_pruebas;
SELECT COUNT(*) AS total, SUM(CASE WHEN estado = 'OK' THEN 1 ELSE 0 END) AS aprobadas FROM #resultado_pruebas;
GO
