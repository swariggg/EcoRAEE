/* =====================================================================
   EcoRAEE Cloud - Datos sintéticos (sin datos personales reales)
   Ejecutar después de 01_esquema.sql.
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
USE EcoRaEE_CLOUD;
GO

/* ---------- Catálogos ---------- */
INSERT INTO rol (id_rol, nombre_rol) VALUES
('ADM', 'Administrador'), ('GEN', 'Generador'), ('OPE', 'Operador de centro'),
('TEC', 'Técnico evaluador'), ('COO', 'Coordinador logístico'),
('REA', 'Reacondicionador/reciclador'), ('BEN', 'Entidad beneficiaria');

INSERT INTO organizacion (id_organizacion, nombre, tipo_organizacion, ubicacion) VALUES
('ORG-FCT', 'Facultad de Ciencias Técnicas', 'Interna', 'Bloque A'),
('ORG-ADM', 'Dirección Administrativa', 'Interna', 'Edificio central'),
('ORG-CS',  'Campus Sostenible', 'Interna', 'Bloque C'),
('ORG-TAL', 'Taller Reacondiciona S.A. (ficticio)', 'Externa', 'Quito norte'),
('ORG-REC', 'EcoGestor Reciclaje (ficticio)', 'Externa', 'Quito sur'),
('ORG-FUN', 'Fundación Conecta (ficticia)', 'Externa', 'Quito centro');

-- Contraseñas: hash de ejemplo, no reales.
INSERT INTO usuario (id_usuario, id_organizacion, id_rol, nombres, apellidos, correo_institucional, hash_password) VALUES
('U-ADM1', 'ORG-CS',  'ADM', 'Admin', 'Sistema', 'admin@ecoraee.test', 'hash_demo'),
('U-GEN1', 'ORG-FCT', 'GEN', 'Estudiante', 'Uno', 'gen1@ecoraee.test', 'hash_demo'),
('U-GEN2', 'ORG-ADM', 'GEN', 'Docente', 'Dos', 'gen2@ecoraee.test', 'hash_demo'),
('U-OPE1', 'ORG-CS',  'OPE', 'Operador', 'Norte', 'ope1@ecoraee.test', 'hash_demo'),
('U-TEC1', 'ORG-CS',  'TEC', 'Técnico', 'Uno', 'tec1@ecoraee.test', 'hash_demo'),
('U-TEC2', 'ORG-CS',  'TEC', 'Técnico', 'Inactivo', 'tec2@ecoraee.test', 'hash_demo'),
('U-COO1', 'ORG-CS',  'COO', 'Coordinador', 'Logístico', 'coo1@ecoraee.test', 'hash_demo'),
('U-REA1', 'ORG-TAL', 'REA', 'Taller', 'Técnico', 'rea1@ecoraee.test', 'hash_demo'),
('U-REC1', 'ORG-REC', 'REA', 'Gestor', 'Reciclaje', 'rec1@ecoraee.test', 'hash_demo'),
('U-BEN1', 'ORG-FUN', 'BEN', 'Fundación', 'Conecta', 'ben1@ecoraee.test', 'hash_demo');
UPDATE usuario SET activo = 0 WHERE id_usuario = 'U-TEC2';

INSERT INTO tipo_centro (id_tipo_centro, nombre_tipo) VALUES
('TC-ACO', 'Punto de acopio'), ('TC-LAB', 'Laboratorio técnico'), ('TC-BOD', 'Bodega');

INSERT INTO centro (id_centro, id_tipo_centro, nombre_centro, capacidad_unidades, capacidad_volumetrica_m3) VALUES
('C-NOR', 'TC-ACO', 'Acopio Campus Norte', 40, 12.00),
('C-SUR', 'TC-ACO', 'Acopio Campus Sur',   10,  4.00),   -- pequeño a propósito (pruebas de capacidad)
('C-LAB', 'TC-LAB', 'Laboratorio de Evaluación', 30, 8.00);

INSERT INTO categoria (id_categoria, nombre_categoria) VALUES
('CAT-LAP', 'Laptop'), ('CAT-PC', 'Computador de escritorio'), ('CAT-MON', 'Monitor'),
('CAT-CEL', 'Celular'), ('CAT-IMP', 'Impresora'), ('CAT-PER', 'Periférico');

INSERT INTO marca (id_marca, nombre_marca) VALUES
('M-DEL', 'Dell'), ('M-HP', 'HP'), ('M-LEN', 'Lenovo'), ('M-SAM', 'Samsung'), ('M-EPS', 'Epson'), ('M-GEN', 'Genérica');

INSERT INTO condicion (id_condicion, nombre_condicion, descripcion) VALUES
('CON-FUN', 'Funcional', 'Enciende y opera sin fallas'),
('CON-FME', 'Falla menor', 'Batería, teclado, pantalla o pieza reemplazable'),
('CON-FMA', 'Falla mayor', 'Placa base u otro componente costoso'),
('CON-DES', 'Destruido', 'Daño físico grave o componentes peligrosos');

INSERT INTO clasificacion (id_clasificacion, nombre_clasificacion) VALUES
('CL-REU', 'Reutilizable'), ('CL-REP', 'Reparable'), ('CL-REC', 'Reciclable'), ('CL-NRE', 'No recuperable');

INSERT INTO tipo_destino (id_tipo_destino, nombre_tipo, estado_resultante) VALUES
('TD-REA', 'Reacondicionador', 'Reacondicionamiento'),
('TD-BEN', 'Beneficiario', 'Asignado'),
('TD-GES', 'Gestor de reciclaje', 'Reciclaje'),
('TD-DIS', 'Disposición final', 'Disposicion');

-- Relación R ⊆ Clasificación × TipoDestino
INSERT INTO compatibilidad_destino (id_clasificacion, id_tipo_destino) VALUES
('CL-REU', 'TD-REA'), ('CL-REU', 'TD-BEN'),
('CL-REP', 'TD-REA'), ('CL-REP', 'TD-BEN'),
('CL-REC', 'TD-GES'),
('CL-NRE', 'TD-DIS');

INSERT INTO destino (id_destino, id_tipo_destino, id_organizacion, nombre_entidad, ruc_identificacion, certificacion_ambiental) VALUES
('D-TAL', 'TD-REA', 'ORG-TAL', 'Taller Reacondiciona', '1790000000001', NULL),
('D-FUN', 'TD-BEN', 'ORG-FUN', 'Fundación Conecta', '1790000000002', NULL),
('D-REC', 'TD-GES', 'ORG-REC', 'EcoGestor Reciclaje', '1790000000003', 'LIC-AMB-0001 (ficticia)'),
('D-DIS', 'TD-DIS', NULL,      'Celda de seguridad municipal', '1790000000004', 'LIC-AMB-0002 (ficticia)');
GO

/* ---------- Solicitudes y dispositivos (generados) ---------- */
INSERT INTO solicitud (id_solicitud, id_usuario_generador, id_centro_destino) VALUES
('S-001', 'U-GEN1', 'C-NOR'),
('S-002', 'U-GEN2', 'C-NOR'),
('S-003', 'U-GEN1', 'C-SUR'),
('S-004', 'U-GEN2', 'C-SUR');   -- queda Pendiente

INSERT INTO lote (id_lote, id_solicitud, codigo_lote) VALUES
('L-001', 'S-001', 'LOTE-2026-001'), ('L-002', 'S-002', 'LOTE-2026-002'), ('L-003', 'S-003', 'LOTE-2026-003'),
('L-004', 'S-004', 'LOTE-2026-004');

INSERT INTO recoleccion (id_recoleccion, id_solicitud, id_usuario_operador, fecha_programada) VALUES
('R-001', 'S-001', 'U-OPE1', '2026-10-05'), ('R-002', 'S-002', 'U-OPE1', '2026-10-06'),
('R-003', 'S-003', 'U-OPE1', '2026-10-07');

-- 36 dispositivos: 12 por solicitud S-001..S-003, con peso realista por categoría.
DECLARE @i INT = 1;
WHILE @i <= 36
BEGIN
    DECLARE @cat VARCHAR(20) = CHOOSE(((@i - 1) % 6) + 1, 'CAT-LAP', 'CAT-PC', 'CAT-MON', 'CAT-CEL', 'CAT-IMP', 'CAT-PER');
    DECLARE @peso DECIMAL(8,2) = CHOOSE(((@i - 1) % 6) + 1, 2.20, 8.50, 4.30, 0.20, 6.00, 0.60) + (@i % 3) * 0.10;
    DECLARE @sol VARCHAR(20) = 'S-00' + CAST(((@i - 1) / 12) + 1 AS VARCHAR(1));
    INSERT INTO dispositivo (id_dispositivo, id_categoria, id_marca, id_lote, numero_serie, modelo, codigo_qr, peso_kg)
    VALUES ('DSP-' + RIGHT('000' + CAST(@i AS VARCHAR(3)), 3), @cat,
            CHOOSE(((@i - 1) % 5) + 1, 'M-DEL', 'M-HP', 'M-LEN', 'M-SAM', 'M-EPS'),
            'L-00' + RIGHT(@sol, 1),
            'SN-' + RIGHT('00000' + CAST(@i * 7919 AS VARCHAR(6)), 6), 'Modelo ' + CAST(@i AS VARCHAR(3)),
            'QR-ECO-' + RIGHT('000' + CAST(@i AS VARCHAR(3)), 3), @peso);
    SET @i += 1;
END;
-- Un equipo de S-004 (solicitud pendiente).
INSERT INTO dispositivo (id_dispositivo, id_categoria, id_marca, id_lote, codigo_qr, peso_kg)
VALUES ('DSP-037', 'CAT-LAP', 'M-HP', 'L-004', 'QR-ECO-037', 2.10);
GO

/* ---------- Recorrido por el ciclo de vida (usando los procedimientos) ---------- */
EXEC sp_recibir_solicitud 'REC-001', 'S-001', 'U-OPE1', 'Estante A';
EXEC sp_recibir_solicitud 'REC-002', 'S-002', 'U-OPE1', 'Estante B';
-- S-003 tiene 12 equipos y el Acopio Sur solo 10: se recibe en el Norte.
UPDATE solicitud SET id_centro_destino = 'C-NOR' WHERE id_solicitud = 'S-003';
EXEC sp_recibir_solicitud 'REC-003', 'S-003', 'U-OPE1', 'Estante C';
GO

-- Evaluar 30 de 36 equipos con una mezcla de clasificaciones.
DECLARE @i INT = 1;
WHILE @i <= 30
BEGIN
    DECLARE @id VARCHAR(20) = 'DSP-' + RIGHT('000' + CAST(@i AS VARCHAR(3)), 3);
    DECLARE @ev VARCHAR(20) = 'EV-' + RIGHT('000' + CAST(@i AS VARCHAR(3)), 3);
    DECLARE @cl VARCHAR(20) = CHOOSE((@i % 5) + 1, 'CL-REU', 'CL-REP', 'CL-REC', 'CL-REC', 'CL-NRE');
    DECLARE @co VARCHAR(20) = CHOOSE((@i % 5) + 1, 'CON-FUN', 'CON-FME', 'CON-FMA', 'CON-FMA', 'CON-DES');
    EXEC sp_registrar_evaluacion @ev, @id, 'U-TEC1', @co, @cl, 'Diagnóstico sintético de prueba';
    SET @i += 1;
END;
GO

-- Mover 8 equipos evaluados del Acopio Norte al Laboratorio (con evidencia y cierre).
DECLARE @i INT = 1;
WHILE @i <= 8
BEGIN
    DECLARE @id VARCHAR(20) = 'DSP-' + RIGHT('000' + CAST(@i AS VARCHAR(3)), 3);
    DECLARE @mv VARCHAR(20) = 'MOV-' + RIGHT('000' + CAST(@i AS VARCHAR(3)), 3);
    EXEC sp_mover_dispositivo @mv, @id, 'C-LAB', 'Mesa 1', 'U-COO1';
    INSERT INTO evidencia (id_evidencia, id_movimiento, id_usuario_carga, url_s3, hash_sha256, tipo_documento)
    VALUES ('EVI-' + @mv, @mv, 'U-COO1', 's3://ecoraee-evidencias/mov/' + @mv + '.pdf',
            CONVERT(CHAR(64), HASHBYTES('SHA2_256', @mv), 2), 'Guía de traslado');
    EXEC sp_cerrar_movimiento @mv;
    SET @i += 1;
END;
GO

-- Ciclos completos de ejemplo:
--  DSP-005 (Reutilizable): Reacondicionador -> Beneficiario -> Cerrado
--  DSP-002 (Reciclable):   Gestor de reciclaje -> Valorizado -> Cerrado
--  DSP-004 (No recuperable): Disposición -> Cerrado
--  DSP-001 (Reparable):    Reacondicionador -> Beneficiario -> Cerrado (al final del bloque)
EXEC sp_asignar_destino 'TR-001', 'DSP-005', 'D-TAL', 'U-COO1';
EXEC sp_registrar_tratamiento 'TRT-001', 'TR-001', 'U-REA1', 'Reacondicionamiento', 'Cambio de batería y formateo';
INSERT INTO evidencia (id_evidencia, id_transferencia, id_usuario_carga, url_s3, hash_sha256, tipo_documento)
VALUES ('EVI-TR-001', 'TR-001', 'U-REA1', 's3://ecoraee-evidencias/tr/TR-001.pdf', CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'TR-001'), 2), 'Acta de recepción');
EXEC sp_confirmar_transferencia 'TR-001';

EXEC sp_asignar_destino 'TR-002', 'DSP-005', 'D-FUN', 'U-COO1';
INSERT INTO evidencia (id_evidencia, id_transferencia, id_usuario_carga, url_s3, hash_sha256, tipo_documento, nivel_acceso)
VALUES ('EVI-TR-002', 'TR-002', 'U-COO1', 's3://ecoraee-evidencias/tr/TR-002.pdf', CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'TR-002'), 2), 'Acta de entrega', 'Restringido');
EXEC sp_confirmar_transferencia 'TR-002';
EXEC sp_cerrar_trazabilidad 'DSP-005', 'U-COO1';

EXEC sp_asignar_destino 'TR-003', 'DSP-002', 'D-REC', 'U-COO1';
EXEC sp_registrar_tratamiento 'TRT-003', 'TR-003', 'U-REC1', 'Reciclaje', 'Separación de metales y plásticos';
INSERT INTO evidencia (id_evidencia, id_transferencia, id_usuario_carga, url_s3, hash_sha256, tipo_documento)
VALUES ('EVI-TR-003', 'TR-003', 'U-REC1', 's3://ecoraee-evidencias/tr/TR-003.pdf', CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'TR-003'), 2), 'Certificado de reciclaje');
EXEC sp_confirmar_transferencia 'TR-003';
EXEC sp_cerrar_trazabilidad 'DSP-002', 'U-COO1';

EXEC sp_asignar_destino 'TR-004', 'DSP-004', 'D-DIS', 'U-COO1';
INSERT INTO evidencia (id_evidencia, id_transferencia, id_usuario_carga, url_s3, hash_sha256, tipo_documento)
VALUES ('EVI-TR-004', 'TR-004', 'U-COO1', 's3://ecoraee-evidencias/tr/TR-004.pdf', CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'TR-004'), 2), 'Acta de disposición');
EXEC sp_confirmar_transferencia 'TR-004';
EXEC sp_cerrar_trazabilidad 'DSP-004', 'U-COO1';

-- DSP-001 (Reparable): está en el Laboratorio; se repara en el taller y se entrega a la fundación.
EXEC sp_asignar_destino 'TR-005', 'DSP-001', 'D-TAL', 'U-COO1';
EXEC sp_registrar_tratamiento 'TRT-005', 'TR-005', 'U-REA1', 'Reacondicionamiento', 'Reparación de pantalla y prueba de funcionamiento';
INSERT INTO evidencia (id_evidencia, id_transferencia, id_usuario_carga, url_s3, hash_sha256, tipo_documento)
VALUES ('EVI-TR-005', 'TR-005', 'U-REA1', 's3://ecoraee-evidencias/tr/TR-005.pdf', CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'TR-005'), 2), 'Acta de recepción');
EXEC sp_confirmar_transferencia 'TR-005';

EXEC sp_asignar_destino 'TR-006', 'DSP-001', 'D-FUN', 'U-COO1';
INSERT INTO evidencia (id_evidencia, id_transferencia, id_usuario_carga, url_s3, hash_sha256, tipo_documento, nivel_acceso)
VALUES ('EVI-TR-006', 'TR-006', 'U-COO1', 's3://ecoraee-evidencias/tr/TR-006.pdf', CONVERT(CHAR(64), HASHBYTES('SHA2_256', 'TR-006'), 2), 'Acta de entrega', 'Restringido');
EXEC sp_confirmar_transferencia 'TR-006';
EXEC sp_cerrar_trazabilidad 'DSP-001', 'U-COO1';
GO

/* ---------- Red para el modelo de flujo máximo (kg por semana) ---------- */
INSERT INTO nodo (id_nodo, nombre_nodo, tipo_nodo, id_centro, id_destino) VALUES
('N-S',   'Fuente (generación del campus)', 'FUENTE', NULL, NULL),
('N-NOR', 'Acopio Campus Norte', 'CENTRO', 'C-NOR', NULL),
('N-SUR', 'Acopio Campus Sur',   'CENTRO', 'C-SUR', NULL),
('N-LAB', 'Laboratorio de Evaluación', 'CENTRO', 'C-LAB', NULL),
('N-TAL', 'Taller Reacondiciona', 'DESTINO', NULL, 'D-TAL'),
('N-FUN', 'Fundación Conecta',    'DESTINO', NULL, 'D-FUN'),
('N-REC', 'EcoGestor Reciclaje',  'DESTINO', NULL, 'D-REC'),
('N-DIS', 'Disposición final',    'DESTINO', NULL, 'D-DIS'),
('N-T',   'Sumidero (destino circular)', 'SUMIDERO', NULL, NULL);

INSERT INTO escenario (id_escenario, nombre_escenario, descripcion, periodo, id_nodo_fuente, id_nodo_sumidero) VALUES
('ESC-1', 'Base', 'Capacidades actuales', 'semana', 'N-S', 'N-T'),
('ESC-2', 'Laboratorio ampliado', 'Se duplica la capacidad de salida del laboratorio', 'semana', 'N-S', 'N-T'),
('ESC-3', 'Campaña de recolección', 'La generación sube 50 % (fin de semestre)', 'semana', 'N-S', 'N-T'),
('ESC-4', 'Destinos ampliados', 'Más recepción en reciclaje (120), fundación (50) y taller -> fundación (50)', 'semana', 'N-S', 'N-T'),
('ESC-5', 'Destinos y laboratorio', 'ESC-4 más el doble de salida del laboratorio', 'semana', 'N-S', 'N-T');

-- Escenario base
INSERT INTO arista (id_escenario, nro_arista, id_nodo_origen, id_nodo_destino, capacidad_kg) VALUES
('ESC-1',  1, 'N-S',   'N-NOR', 120), ('ESC-1',  2, 'N-S',   'N-SUR',  80),
('ESC-1',  3, 'N-NOR', 'N-LAB',  70), ('ESC-1',  4, 'N-SUR', 'N-LAB',  50),
('ESC-1',  5, 'N-NOR', 'N-REC',  40), ('ESC-1',  6, 'N-SUR', 'N-REC',  20),
('ESC-1',  7, 'N-LAB', 'N-TAL',  40), ('ESC-1',  8, 'N-LAB', 'N-REC',  30),
('ESC-1',  9, 'N-LAB', 'N-DIS',  15), ('ESC-1', 10, 'N-TAL', 'N-FUN',  35),
('ESC-1', 11, 'N-FUN', 'N-T',    35), ('ESC-1', 12, 'N-REC', 'N-T',    90),
('ESC-1', 13, 'N-DIS', 'N-T',    20);

-- Escenario 2: igual al base, pero el laboratorio despacha el doble.
INSERT INTO arista (id_escenario, nro_arista, id_nodo_origen, id_nodo_destino, capacidad_kg)
SELECT 'ESC-2', nro_arista, id_nodo_origen, id_nodo_destino,
       CASE WHEN id_nodo_origen = 'N-LAB' THEN capacidad_kg * 2 ELSE capacidad_kg END
FROM arista WHERE id_escenario = 'ESC-1';

-- Escenario 3: igual al base, pero la generación (aristas desde la fuente) sube 50 %.
INSERT INTO arista (id_escenario, nro_arista, id_nodo_origen, id_nodo_destino, capacidad_kg)
SELECT 'ESC-3', nro_arista, id_nodo_origen, id_nodo_destino,
       CASE WHEN id_nodo_origen = 'N-S' THEN capacidad_kg * 1.5 ELSE capacidad_kg END
FROM arista WHERE id_escenario = 'ESC-1';

-- Escenario 4: se amplía la recepción de los destinos.
INSERT INTO arista (id_escenario, nro_arista, id_nodo_origen, id_nodo_destino, capacidad_kg)
SELECT 'ESC-4', nro_arista, id_nodo_origen, id_nodo_destino,
       CASE WHEN id_nodo_origen = 'N-REC' AND id_nodo_destino = 'N-T'   THEN 120
            WHEN id_nodo_origen = 'N-FUN' AND id_nodo_destino = 'N-T'   THEN 50
            WHEN id_nodo_origen = 'N-TAL' AND id_nodo_destino = 'N-FUN' THEN 50
            ELSE capacidad_kg END
FROM arista WHERE id_escenario = 'ESC-1';

-- Escenario 5: ESC-4 y además el laboratorio despacha el doble.
INSERT INTO arista (id_escenario, nro_arista, id_nodo_origen, id_nodo_destino, capacidad_kg)
SELECT 'ESC-5', nro_arista, id_nodo_origen, id_nodo_destino,
       CASE WHEN id_nodo_origen = 'N-LAB' THEN capacidad_kg * 2 ELSE capacidad_kg END
FROM arista WHERE id_escenario = 'ESC-4';
GO

/* ---------- Resultados del flujo máximo (Edmonds-Karp, programa flujo_maximo.py) ----------
   Se guardan con el procedimiento, que valida RN-05 (flujo <= capacidad) por trigger. */
-- ESC-1: flujo máximo 140 kg. Corte: LAB->DIS (15) + FUN->T (35) + REC->T (90) = 140
EXEC sp_guardar_resultado_flujo 'ESC-1', 140,
N'[{"nro_arista": 1, "flujo_kg": 110, "en_corte_minimo": 0},
   {"nro_arista": 2, "flujo_kg": 30, "en_corte_minimo": 0},
   {"nro_arista": 3, "flujo_kg": 70, "en_corte_minimo": 0},
   {"nro_arista": 4, "flujo_kg": 10, "en_corte_minimo": 0},
   {"nro_arista": 5, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 6, "flujo_kg": 20, "en_corte_minimo": 0},
   {"nro_arista": 7, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 8, "flujo_kg": 30, "en_corte_minimo": 0},
   {"nro_arista": 9, "flujo_kg": 15, "en_corte_minimo": 1},
   {"nro_arista": 10, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 11, "flujo_kg": 35, "en_corte_minimo": 1},
   {"nro_arista": 12, "flujo_kg": 90, "en_corte_minimo": 1},
   {"nro_arista": 13, "flujo_kg": 15, "en_corte_minimo": 0}]';
-- ESC-2: flujo máximo 145 kg. Corte: FUN->T (35) + REC->T (90) + DIS->T (20) = 145
EXEC sp_guardar_resultado_flujo 'ESC-2', 145,
N'[{"nro_arista": 1, "flujo_kg": 110, "en_corte_minimo": 0},
   {"nro_arista": 2, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 3, "flujo_kg": 70, "en_corte_minimo": 0},
   {"nro_arista": 4, "flujo_kg": 15, "en_corte_minimo": 0},
   {"nro_arista": 5, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 6, "flujo_kg": 20, "en_corte_minimo": 0},
   {"nro_arista": 7, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 8, "flujo_kg": 30, "en_corte_minimo": 0},
   {"nro_arista": 9, "flujo_kg": 20, "en_corte_minimo": 0},
   {"nro_arista": 10, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 11, "flujo_kg": 35, "en_corte_minimo": 1},
   {"nro_arista": 12, "flujo_kg": 90, "en_corte_minimo": 1},
   {"nro_arista": 13, "flujo_kg": 20, "en_corte_minimo": 1}]';
-- ESC-3: flujo máximo 140 kg. Corte: LAB->DIS (15) + FUN->T (35) + REC->T (90) = 140
EXEC sp_guardar_resultado_flujo 'ESC-3', 140,
N'[{"nro_arista": 1, "flujo_kg": 110, "en_corte_minimo": 0},
   {"nro_arista": 2, "flujo_kg": 30, "en_corte_minimo": 0},
   {"nro_arista": 3, "flujo_kg": 70, "en_corte_minimo": 0},
   {"nro_arista": 4, "flujo_kg": 10, "en_corte_minimo": 0},
   {"nro_arista": 5, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 6, "flujo_kg": 20, "en_corte_minimo": 0},
   {"nro_arista": 7, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 8, "flujo_kg": 30, "en_corte_minimo": 0},
   {"nro_arista": 9, "flujo_kg": 15, "en_corte_minimo": 1},
   {"nro_arista": 10, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 11, "flujo_kg": 35, "en_corte_minimo": 1},
   {"nro_arista": 12, "flujo_kg": 90, "en_corte_minimo": 1},
   {"nro_arista": 13, "flujo_kg": 15, "en_corte_minimo": 0}]';
-- ESC-4: flujo máximo 145 kg. Corte: NOR->REC (40) + SUR->REC (20) + LAB->TAL (40) + LAB->REC (30) + LAB->DIS (15) = 145
EXEC sp_guardar_resultado_flujo 'ESC-4', 145,
N'[{"nro_arista": 1, "flujo_kg": 110, "en_corte_minimo": 0},
   {"nro_arista": 2, "flujo_kg": 35, "en_corte_minimo": 0},
   {"nro_arista": 3, "flujo_kg": 70, "en_corte_minimo": 0},
   {"nro_arista": 4, "flujo_kg": 15, "en_corte_minimo": 0},
   {"nro_arista": 5, "flujo_kg": 40, "en_corte_minimo": 1},
   {"nro_arista": 6, "flujo_kg": 20, "en_corte_minimo": 1},
   {"nro_arista": 7, "flujo_kg": 40, "en_corte_minimo": 1},
   {"nro_arista": 8, "flujo_kg": 30, "en_corte_minimo": 1},
   {"nro_arista": 9, "flujo_kg": 15, "en_corte_minimo": 1},
   {"nro_arista": 10, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 11, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 12, "flujo_kg": 90, "en_corte_minimo": 0},
   {"nro_arista": 13, "flujo_kg": 15, "en_corte_minimo": 0}]';
-- ESC-5: flujo máximo 180 kg. Corte: NOR->LAB (70) + SUR->LAB (50) + NOR->REC (40) + SUR->REC (20) = 180
EXEC sp_guardar_resultado_flujo 'ESC-5', 180,
N'[{"nro_arista": 1, "flujo_kg": 110, "en_corte_minimo": 0},
   {"nro_arista": 2, "flujo_kg": 70, "en_corte_minimo": 0},
   {"nro_arista": 3, "flujo_kg": 70, "en_corte_minimo": 1},
   {"nro_arista": 4, "flujo_kg": 50, "en_corte_minimo": 1},
   {"nro_arista": 5, "flujo_kg": 40, "en_corte_minimo": 1},
   {"nro_arista": 6, "flujo_kg": 20, "en_corte_minimo": 1},
   {"nro_arista": 7, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 8, "flujo_kg": 60, "en_corte_minimo": 0},
   {"nro_arista": 9, "flujo_kg": 20, "en_corte_minimo": 0},
   {"nro_arista": 10, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 11, "flujo_kg": 40, "en_corte_minimo": 0},
   {"nro_arista": 12, "flujo_kg": 120, "en_corte_minimo": 0},
   {"nro_arista": 13, "flujo_kg": 20, "en_corte_minimo": 0}]';
GO

EXEC sp_calcular_indicadores '2026-10';
GO
