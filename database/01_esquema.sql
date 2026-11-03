/* =====================================================================
   EcoRAEE Cloud - Esquema de base de datos (SQL Server / Amazon RDS)
   Versión 5 - base EcoRaEE_CLOUD. [v5] resultado es entidad débil de escenario (2FN de resultado_arista).
   [v4] dispositivo ya no guarda
   id_solicitud (se obtiene del lote, 3FN) y id_lote es obligatorio.
   Ejecutar completo: borra y recrea la base (reproducibilidad, RNF-09).
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;   -- necesario para los índices filtrados
GO
USE master;
GO
IF DB_ID('EcoRaEE_CLOUD') IS NOT NULL
BEGIN
    ALTER DATABASE EcoRaEE_CLOUD SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE EcoRaEE_CLOUD;
END;
GO
CREATE DATABASE EcoRaEE_CLOUD;
GO
-- En SQL Server Express AUTO_CLOSE viene activado: cierra la base cuando no hay conexiones
-- y la vuelve a abrir en la siguiente petición (la API se siente lenta). Se desactiva.
ALTER DATABASE EcoRaEE_CLOUD SET AUTO_CLOSE OFF;
GO
USE EcoRaEE_CLOUD;
GO

/* ---------- Usuarios, roles y organizaciones ---------- */
-- [CAMBIO] "dependencia" pasa a "organizacion": incluye dependencias internas
-- de la universidad y entidades externas (fundaciones, gestores, talleres).
CREATE TABLE organizacion (
    id_organizacion VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tipo_organizacion VARCHAR(10) NOT NULL CHECK (tipo_organizacion IN ('Interna', 'Externa')),
    ubicacion VARCHAR(150) NULL
);

CREATE TABLE rol (
    id_rol VARCHAR(20) PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuario (
    id_usuario VARCHAR(20) PRIMARY KEY,
    id_organizacion VARCHAR(20) NOT NULL,
    id_rol VARCHAR(20) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    correo_institucional VARCHAR(150) NOT NULL UNIQUE,
    hash_password VARCHAR(255) NOT NULL,
    activo BIT DEFAULT 1 NOT NULL,
    FOREIGN KEY (id_organizacion) REFERENCES organizacion(id_organizacion),
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
);

/* ---------- Centros ---------- */
CREATE TABLE tipo_centro (
    id_tipo_centro VARCHAR(20) PRIMARY KEY,
    nombre_tipo VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE centro (
    id_centro VARCHAR(20) PRIMARY KEY,
    id_tipo_centro VARCHAR(20) NOT NULL,
    nombre_centro VARCHAR(100) NOT NULL UNIQUE,
    capacidad_unidades INT NOT NULL CHECK (capacidad_unidades > 0),
    capacidad_volumetrica_m3 DECIMAL(10,2) NOT NULL CHECK (capacidad_volumetrica_m3 > 0),
    -- Dato DERIVADO (= COUNT de dispositivos con id_centro_actual = este centro).
    -- Se guarda a propósito (desnormalización controlada) para que el CHECK de
    -- capacidad provoque el ROLLBACK de RN-06 y no haya que contar en cada operación.
    -- Se puede verificar con la vista vw_ocupacion_centro.
    ocupacion_actual_unidades INT DEFAULT 0 NOT NULL,
    FOREIGN KEY (id_tipo_centro) REFERENCES tipo_centro(id_tipo_centro),
    CONSTRAINT ck_centro_capacidad CHECK (ocupacion_actual_unidades BETWEEN 0 AND capacidad_unidades)
);

/* ---------- Catálogos del dispositivo ---------- */
CREATE TABLE categoria (
    id_categoria VARCHAR(20) PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE marca (
    id_marca VARCHAR(20) PRIMARY KEY,
    nombre_marca VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE condicion (
    id_condicion VARCHAR(20) PRIMARY KEY,
    nombre_condicion VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200) NULL
);

-- [NUEVO] Catálogo de clasificaciones técnicas (antes era un CHECK).
-- Incluye las 4 que exige el proyecto, con "Reparable".
CREATE TABLE clasificacion (
    id_clasificacion VARCHAR(20) PRIMARY KEY,
    nombre_clasificacion VARCHAR(30) NOT NULL UNIQUE
);

-- [NUEVO] Catálogo de tipos de destino. estado_resultante dice a qué estado
-- pasa el dispositivo cuando se le asigna un destino de ese tipo.
CREATE TABLE tipo_destino (
    id_tipo_destino VARCHAR(20) PRIMARY KEY,
    nombre_tipo VARCHAR(30) NOT NULL UNIQUE,
    estado_resultante VARCHAR(30) NOT NULL CHECK (
        estado_resultante IN ('Reacondicionamiento', 'Asignado', 'Reciclaje', 'Disposicion')
    )
);

-- [NUEVO] Relación R ⊆ Clasificación × TipoDestino (Matemática Discreta, RF-MD-02).
-- Solo se puede transferir un equipo a un destino si el par existe aquí.
-- RN-04 sale de aquí: no existe el par (No recuperable, Beneficiario).
CREATE TABLE compatibilidad_destino (
    id_clasificacion VARCHAR(20) NOT NULL,
    id_tipo_destino VARCHAR(20) NOT NULL,
    PRIMARY KEY (id_clasificacion, id_tipo_destino),
    FOREIGN KEY (id_clasificacion) REFERENCES clasificacion(id_clasificacion),
    FOREIGN KEY (id_tipo_destino) REFERENCES tipo_destino(id_tipo_destino)
);

/* ---------- Solicitud, lote y dispositivo ---------- */
CREATE TABLE solicitud (
    id_solicitud VARCHAR(20) PRIMARY KEY,
    id_usuario_generador VARCHAR(20) NOT NULL,
    id_centro_destino VARCHAR(20) NOT NULL,
    fecha_solicitud DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    estado_solicitud VARCHAR(20) DEFAULT 'Pendiente' NOT NULL CHECK (
        estado_solicitud IN ('Pendiente', 'Recibida', 'Cancelada')
    ),
    FOREIGN KEY (id_usuario_generador) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_centro_destino) REFERENCES centro(id_centro)
);

-- [CAMBIO] El lote ahora pertenece a una solicitud (una entrega puede venir en
-- uno o varios lotes) y deja de estar aislado.
CREATE TABLE lote (
    id_lote VARCHAR(20) PRIMARY KEY,
    id_solicitud VARCHAR(20) NOT NULL,
    codigo_lote VARCHAR(50) NOT NULL UNIQUE,
    fecha_creacion DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    FOREIGN KEY (id_solicitud) REFERENCES solicitud(id_solicitud)
);

-- [CAMBIO]
--  * [CAMBIO v4] Se quitó id_solicitud: la solicitud se obtiene del lote
--    (id_dispositivo -> id_lote -> id_solicitud era una dependencia transitiva,
--    viola 3FN). Por eso id_lote pasa a ser obligatorio: todo equipo llega en un lote.
--  * Tampoco guarda el generador: se obtiene de lote -> solicitud.
--  * peso_kg alimenta el modelo de flujo máximo en kg (RF-INT-04).
--  * Se agregan los estados Asignado y Valorizado (ciclo del Apéndice A.4).
CREATE TABLE dispositivo (
    id_dispositivo VARCHAR(20) PRIMARY KEY,
    id_categoria VARCHAR(20) NOT NULL,
    id_marca VARCHAR(20) NOT NULL,
    id_lote VARCHAR(20) NOT NULL,
    -- Inventario: en qué centro está hoy, en qué ubicación y desde cuándo.
    id_centro_actual VARCHAR(20) NULL,
    ubicacion_centro VARCHAR(30) NULL,
    fecha_ingreso_centro DATETIME2 NULL,
    numero_serie VARCHAR(100) NULL,
    modelo VARCHAR(100) NULL,
    codigo_qr VARCHAR(255) NOT NULL UNIQUE,
    peso_kg DECIMAL(8,2) NOT NULL CHECK (peso_kg > 0),
    estado_actual VARCHAR(30) DEFAULT 'Registrado' NOT NULL CHECK (
        estado_actual IN ('Registrado', 'Recolectado', 'Evaluado',
                          'Reacondicionamiento', 'Asignado',
                          'Reciclaje', 'Valorizado',
                          'Disposicion', 'Cerrado')
    ),
    fecha_registro DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria),
    FOREIGN KEY (id_marca) REFERENCES marca(id_marca),
    FOREIGN KEY (id_lote) REFERENCES lote(id_lote),
    FOREIGN KEY (id_centro_actual) REFERENCES centro(id_centro)
);
CREATE UNIQUE INDEX uq_dispositivo_serie ON dispositivo(numero_serie) WHERE numero_serie IS NOT NULL;

CREATE TABLE recoleccion (
    id_recoleccion VARCHAR(20) PRIMARY KEY,
    id_solicitud VARCHAR(20) NOT NULL UNIQUE,
    id_usuario_operador VARCHAR(20) NOT NULL,
    fecha_programada DATETIME2 NOT NULL,
    fecha_realizada DATETIME2 NULL,
    FOREIGN KEY (id_solicitud) REFERENCES solicitud(id_solicitud),
    FOREIGN KEY (id_usuario_operador) REFERENCES usuario(id_usuario)
);

CREATE TABLE recepcion (
    id_recepcion VARCHAR(20) PRIMARY KEY,
    id_solicitud VARCHAR(20) NOT NULL UNIQUE,
    id_usuario_operador VARCHAR(20) NOT NULL,
    fecha_recepcion DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    cantidad_recibida INT NOT NULL CHECK (cantidad_recibida > 0),
    observaciones VARCHAR(300) NULL,
    FOREIGN KEY (id_solicitud) REFERENCES solicitud(id_solicitud),
    FOREIGN KEY (id_usuario_operador) REFERENCES usuario(id_usuario)
);

/* ---------- Evaluación e historial ---------- */
CREATE TABLE evaluacion (
    id_evaluacion VARCHAR(20) PRIMARY KEY,
    id_dispositivo VARCHAR(20) NOT NULL,
    id_usuario_tecnico VARCHAR(20) NOT NULL,
    id_condicion VARCHAR(20) NOT NULL,
    id_clasificacion VARCHAR(20) NOT NULL,          -- [CAMBIO] FK al catálogo
    diagnostico VARCHAR(MAX) NOT NULL,
    fecha_evaluacion DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    FOREIGN KEY (id_dispositivo) REFERENCES dispositivo(id_dispositivo),
    FOREIGN KEY (id_usuario_tecnico) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_condicion) REFERENCES condicion(id_condicion),
    FOREIGN KEY (id_clasificacion) REFERENCES clasificacion(id_clasificacion)
);

-- ENTIDAD DÉBIL de dispositivo: se identifica con (id_dispositivo + nro_cambio).
-- La llena automáticamente un trigger (RN-01).
CREATE TABLE historial (
    id_dispositivo VARCHAR(20) NOT NULL,
    nro_cambio INT NOT NULL,
    id_usuario_responsable VARCHAR(20) NOT NULL,
    estado_anterior VARCHAR(30) NULL,
    estado_nuevo VARCHAR(30) NOT NULL,
    fecha_cambio DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    PRIMARY KEY (id_dispositivo, nro_cambio),
    FOREIGN KEY (id_dispositivo) REFERENCES dispositivo(id_dispositivo),
    FOREIGN KEY (id_usuario_responsable) REFERENCES usuario(id_usuario)
);

/* ---------- Movimientos, destinos, transferencias ---------- */
CREATE TABLE movimiento (
    id_movimiento VARCHAR(20) PRIMARY KEY,
    id_dispositivo VARCHAR(20) NOT NULL,
    id_centro_origen VARCHAR(20) NOT NULL,
    id_centro_destino VARCHAR(20) NOT NULL,
    id_usuario_coordinador VARCHAR(20) NOT NULL,
    fecha_salida DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    fecha_recepcion DATETIME2 NULL,
    estado_movimiento VARCHAR(20) DEFAULT 'Abierto' NOT NULL CHECK (estado_movimiento IN ('Abierto', 'Cerrado')),
    CHECK (id_centro_origen <> id_centro_destino),
    CONSTRAINT ck_movimiento_fecha CHECK (estado_movimiento <> 'Cerrado' OR fecha_recepcion IS NOT NULL),
    FOREIGN KEY (id_dispositivo) REFERENCES dispositivo(id_dispositivo),
    FOREIGN KEY (id_centro_origen) REFERENCES centro(id_centro),
    FOREIGN KEY (id_centro_destino) REFERENCES centro(id_centro),
    FOREIGN KEY (id_usuario_coordinador) REFERENCES usuario(id_usuario)
);

-- [CAMBIO] tipo de destino por FK; se agrega Reacondicionador.
CREATE TABLE destino (
    id_destino VARCHAR(20) PRIMARY KEY,
    id_tipo_destino VARCHAR(20) NOT NULL,
    id_organizacion VARCHAR(20) NULL,       -- organización externa que lo opera
    nombre_entidad VARCHAR(150) NOT NULL,
    ruc_identificacion VARCHAR(20) NOT NULL UNIQUE,
    certificacion_ambiental VARCHAR(100) NULL,
    FOREIGN KEY (id_tipo_destino) REFERENCES tipo_destino(id_tipo_destino),
    FOREIGN KEY (id_organizacion) REFERENCES organizacion(id_organizacion)
);

-- [CAMBIO] Se quitó UNIQUE de id_dispositivo: un equipo reutilizable tiene dos
-- transferencias (al reacondicionador y luego al beneficiario). El índice
-- filtrado de abajo impide que tenga dos transferencias ABIERTAS a la vez.
CREATE TABLE transferencia (
    id_transferencia VARCHAR(20) PRIMARY KEY,
    id_dispositivo VARCHAR(20) NOT NULL,
    id_destino VARCHAR(20) NOT NULL,
    id_usuario_coordinador VARCHAR(20) NOT NULL,
    fecha_transferencia DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    estado_cierre VARCHAR(20) DEFAULT 'Pendiente_Evidencia' NOT NULL CHECK (
        estado_cierre IN ('Pendiente_Evidencia', 'Cerrado')
    ),
    fecha_confirmacion_cierre DATETIME2 NULL,
    -- RN-08: no se puede cerrar sin fecha de confirmación.
    CONSTRAINT ck_rn08_fecha CHECK (estado_cierre <> 'Cerrado' OR fecha_confirmacion_cierre IS NOT NULL),
    FOREIGN KEY (id_dispositivo) REFERENCES dispositivo(id_dispositivo),
    FOREIGN KEY (id_destino) REFERENCES destino(id_destino),
    FOREIGN KEY (id_usuario_coordinador) REFERENCES usuario(id_usuario)
);
CREATE UNIQUE INDEX uq_transferencia_abierta ON transferencia(id_dispositivo)
    WHERE estado_cierre = 'Pendiente_Evidencia';

CREATE TABLE tratamiento (
    id_tratamiento VARCHAR(20) PRIMARY KEY,
    id_transferencia VARCHAR(20) NOT NULL UNIQUE,
    id_usuario_responsable VARCHAR(20) NOT NULL,
    tipo_tratamiento VARCHAR(30) NOT NULL CHECK (
        tipo_tratamiento IN ('Reacondicionamiento', 'Reciclaje', 'Disposicion_controlada')
    ),
    resultado VARCHAR(300) NOT NULL,
    fecha_tratamiento DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    FOREIGN KEY (id_transferencia) REFERENCES transferencia(id_transferencia),
    FOREIGN KEY (id_usuario_responsable) REFERENCES usuario(id_usuario)
);

-- [CAMBIO] quién la subió, cuándo y quién puede verla (RN-07).
CREATE TABLE evidencia (
    id_evidencia VARCHAR(20) PRIMARY KEY,
    id_transferencia VARCHAR(20) NULL,
    id_evaluacion VARCHAR(20) NULL,
    id_movimiento VARCHAR(20) NULL,
    id_usuario_carga VARCHAR(20) NOT NULL,
    url_s3 VARCHAR(500) NOT NULL,
    hash_sha256 CHAR(64) NOT NULL UNIQUE,
    tipo_documento VARCHAR(50) NOT NULL,
    nivel_acceso VARCHAR(20) DEFAULT 'Interno' NOT NULL CHECK (nivel_acceso IN ('Interno', 'Restringido')),
    fecha_carga DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    FOREIGN KEY (id_transferencia) REFERENCES transferencia(id_transferencia),
    FOREIGN KEY (id_evaluacion) REFERENCES evaluacion(id_evaluacion),
    FOREIGN KEY (id_movimiento) REFERENCES movimiento(id_movimiento),
    FOREIGN KEY (id_usuario_carga) REFERENCES usuario(id_usuario),
    -- Una evidencia respalda exactamente UNA operación.
    CONSTRAINT chk_evidencia_origen CHECK (
        (CASE WHEN id_transferencia IS NULL THEN 0 ELSE 1 END
       + CASE WHEN id_evaluacion   IS NULL THEN 0 ELSE 1 END
       + CASE WHEN id_movimiento   IS NULL THEN 0 ELSE 1 END) = 1
    )
);

/* ---------- Modelo de red (Matemática Discreta) ---------- */
-- [CAMBIO] tipo_nodo permite la super-fuente y el super-sumidero que necesita
-- Edmonds-Karp cuando hay varios centros de origen y varios destinos.
CREATE TABLE nodo (
    id_nodo VARCHAR(20) PRIMARY KEY,
    nombre_nodo VARCHAR(100) NOT NULL,
    tipo_nodo VARCHAR(10) NOT NULL CHECK (tipo_nodo IN ('CENTRO', 'DESTINO', 'FUENTE', 'SUMIDERO')),
    id_centro VARCHAR(20) NULL,
    id_destino VARCHAR(20) NULL,
    FOREIGN KEY (id_centro) REFERENCES centro(id_centro),
    FOREIGN KEY (id_destino) REFERENCES destino(id_destino),
    CONSTRAINT ck_nodo_tipo CHECK (
           (tipo_nodo = 'CENTRO'  AND id_centro IS NOT NULL AND id_destino IS NULL)
        OR (tipo_nodo = 'DESTINO' AND id_centro IS NULL AND id_destino IS NOT NULL)
        OR (tipo_nodo IN ('FUENTE', 'SUMIDERO') AND id_centro IS NULL AND id_destino IS NULL)
    )
);
CREATE UNIQUE INDEX uq_nodo_centro ON nodo(id_centro) WHERE id_centro IS NOT NULL;
CREATE UNIQUE INDEX uq_nodo_destino ON nodo(id_destino) WHERE id_destino IS NOT NULL;

CREATE TABLE escenario (
    id_escenario VARCHAR(20) PRIMARY KEY,
    nombre_escenario VARCHAR(100) NOT NULL,
    descripcion VARCHAR(300) NULL,
    periodo VARCHAR(30) NOT NULL,                 -- p. ej. 'semana', 'mes'
    fecha_creacion DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    id_nodo_fuente VARCHAR(20) NOT NULL,
    id_nodo_sumidero VARCHAR(20) NOT NULL,
    CHECK (id_nodo_fuente <> id_nodo_sumidero),
    FOREIGN KEY (id_nodo_fuente) REFERENCES nodo(id_nodo),
    FOREIGN KEY (id_nodo_sumidero) REFERENCES nodo(id_nodo)
);

-- ENTIDAD DÉBIL de escenario. [CAMBIO] Solo guarda la ENTRADA (capacidad);
-- los resultados del algoritmo van en resultado_arista.
CREATE TABLE arista (
    id_escenario VARCHAR(20) NOT NULL,
    nro_arista INT NOT NULL,
    id_nodo_origen VARCHAR(20) NOT NULL,
    id_nodo_destino VARCHAR(20) NOT NULL,
    capacidad_kg DECIMAL(10,2) NOT NULL CHECK (capacidad_kg > 0),
    PRIMARY KEY (id_escenario, nro_arista),
    CONSTRAINT uq_arista_par UNIQUE (id_escenario, id_nodo_origen, id_nodo_destino),
    CHECK (id_nodo_origen <> id_nodo_destino),
    FOREIGN KEY (id_escenario) REFERENCES escenario(id_escenario),
    FOREIGN KEY (id_nodo_origen) REFERENCES nodo(id_nodo),
    FOREIGN KEY (id_nodo_destino) REFERENCES nodo(id_nodo)
);

-- [CAMBIO v5] ENTIDAD DÉBIL de escenario: cada ejecución se identifica con
-- (id_escenario + nro_ejecucion). Se guardan todas las ejecuciones.
CREATE TABLE resultado (
    id_escenario VARCHAR(20) NOT NULL,
    nro_ejecucion INT NOT NULL,
    algoritmo VARCHAR(30) DEFAULT 'Edmonds-Karp' NOT NULL,
    flujo_maximo_kg DECIMAL(12,2) NOT NULL CHECK (flujo_maximo_kg >= 0),
    fecha_ejecucion DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    PRIMARY KEY (id_escenario, nro_ejecucion),
    FOREIGN KEY (id_escenario) REFERENCES escenario(id_escenario)
);

-- ENTIDAD DÉBIL de resultado: flujo por arista y si la arista es parte
-- del corte mínimo. RN-05 (flujo <= capacidad) lo valida un trigger.
-- [CAMBIO v5] id_escenario es parte de la clave (viene de resultado y de arista),
-- así ningún atributo depende de solo una parte de la clave (2FN) y las dos FK
-- garantizan que la arista sea del mismo escenario que la ejecución.
CREATE TABLE resultado_arista (
    id_escenario VARCHAR(20) NOT NULL,
    nro_ejecucion INT NOT NULL,
    nro_arista INT NOT NULL,
    flujo_kg DECIMAL(10,2) NOT NULL CHECK (flujo_kg >= 0),
    en_corte_minimo BIT DEFAULT 0 NOT NULL,
    PRIMARY KEY (id_escenario, nro_ejecucion, nro_arista),
    FOREIGN KEY (id_escenario, nro_ejecucion) REFERENCES resultado(id_escenario, nro_ejecucion),
    FOREIGN KEY (id_escenario, nro_arista) REFERENCES arista(id_escenario, nro_arista)
);

/* ---------- Auditoría, alerta e indicador ---------- */
CREATE TABLE auditoria (
    id_auditoria INT IDENTITY(1,1) PRIMARY KEY,
    tabla_afectada VARCHAR(50) NOT NULL,
    operacion VARCHAR(20) NOT NULL,
    detalle VARCHAR(300) NOT NULL,
    id_usuario VARCHAR(20) NULL,
    fecha DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE TABLE alerta (
    id_alerta INT IDENTITY(1,1) PRIMARY KEY,
    id_centro VARCHAR(20) NOT NULL,
    mensaje VARCHAR(300) NOT NULL,
    estado_alerta VARCHAR(20) DEFAULT 'Abierta' NOT NULL CHECK (estado_alerta IN ('Abierta', 'Atendida')),
    fecha DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    FOREIGN KEY (id_centro) REFERENCES centro(id_centro)
);

-- Indicadores por periodo (mes): datos DERIVADOS, los calcula un procedimiento.
CREATE TABLE indicador (
    id_indicador INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    periodo CHAR(7) NOT NULL,                  -- 'AAAA-MM'
    valor DECIMAL(12,2) NOT NULL,
    fecha_calculo DATETIME2 DEFAULT SYSDATETIME() NOT NULL,
    UNIQUE (nombre, periodo)
);
GO

/* =====================================================================
   TRIGGERS (reglas de negocio)
   ===================================================================== */

-- RN-01: al registrar un dispositivo empieza en "Registrado" y se guarda su
-- primer cambio en el historial. El responsable es el generador de la solicitud.
CREATE TRIGGER tr_dispositivo_registro ON dispositivo
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted WHERE estado_actual <> 'Registrado')
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50001, 'RN-01: todo dispositivo nuevo debe empezar en estado Registrado.', 1;
    END;

    INSERT INTO historial (id_dispositivo, nro_cambio, id_usuario_responsable, estado_anterior, estado_nuevo)
    SELECT i.id_dispositivo, 1, s.id_usuario_generador, NULL, 'Registrado'
    FROM inserted i JOIN lote l ON l.id_lote = i.id_lote JOIN solicitud s ON s.id_solicitud = l.id_solicitud;

    INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario)
    SELECT 'dispositivo', 'INSERT', 'Registro de ' + i.id_dispositivo, s.id_usuario_generador
    FROM inserted i JOIN lote l ON l.id_lote = i.id_lote JOIN solicitud s ON s.id_solicitud = l.id_solicitud;
END;
GO

-- RN-01 y CP-03: cada cambio de estado sigue el ciclo de vida (Apéndice A.4)
-- y queda en el historial con su responsable.
--   Registrado -> Recolectado -> Evaluado
--   Evaluado -> Reacondicionamiento -> Asignado -> Cerrado
--   Evaluado -> Reciclaje -> Valorizado -> Cerrado
--   Evaluado -> Disposicion -> Cerrado
CREATE TRIGGER tr_dispositivo_cambio_estado ON dispositivo
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(estado_actual) RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted i JOIN deleted d ON d.id_dispositivo = i.id_dispositivo
        WHERE i.estado_actual <> d.estado_actual
          AND NOT (   (d.estado_actual = 'Registrado'          AND i.estado_actual = 'Recolectado')
                   OR (d.estado_actual = 'Recolectado'         AND i.estado_actual = 'Evaluado')
                   OR (d.estado_actual = 'Evaluado'            AND i.estado_actual IN ('Reacondicionamiento', 'Reciclaje', 'Disposicion'))
                   OR (d.estado_actual = 'Reacondicionamiento' AND i.estado_actual = 'Asignado')
                   OR (d.estado_actual = 'Reciclaje'           AND i.estado_actual = 'Valorizado')
                   OR (d.estado_actual IN ('Asignado', 'Valorizado', 'Disposicion') AND i.estado_actual = 'Cerrado'))
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50002, 'CP-03: cambio de estado no permitido.', 1;
    END;

    DECLARE @responsable VARCHAR(20) = CAST(SESSION_CONTEXT(N'id_usuario') AS VARCHAR(20));
    IF @responsable IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50003, 'RN-01: falta indicar el usuario responsable del cambio.', 1;
    END;

    INSERT INTO historial (id_dispositivo, nro_cambio, id_usuario_responsable, estado_anterior, estado_nuevo)
    SELECT i.id_dispositivo,
           (SELECT MAX(h.nro_cambio) FROM historial h WHERE h.id_dispositivo = i.id_dispositivo) + 1,
           @responsable, d.estado_actual, i.estado_actual
    FROM inserted i JOIN deleted d ON d.id_dispositivo = i.id_dispositivo
    WHERE i.estado_actual <> d.estado_actual;

    INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario)
    SELECT 'dispositivo', 'UPDATE', i.id_dispositivo + ': ' + d.estado_actual + ' -> ' + i.estado_actual, @responsable
    FROM inserted i JOIN deleted d ON d.id_dispositivo = i.id_dispositivo
    WHERE i.estado_actual <> d.estado_actual;
END;
GO

CREATE TRIGGER tr_historial_protegido ON historial
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    ROLLBACK TRANSACTION;
    THROW 50004, 'RN-01: el historial no se puede modificar ni borrar.', 1;
END;
GO

-- RN-02: solo un técnico activo registra o cambia una evaluación.
CREATE TRIGGER tr_evaluacion_tecnico ON evaluacion
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i
               JOIN usuario u ON u.id_usuario = i.id_usuario_tecnico
               WHERE u.id_rol <> 'TEC' OR u.activo = 0)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50010, 'RN-02: solo un técnico autorizado puede registrar o cambiar una evaluación.', 1;
    END;

    INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario)
    SELECT 'evaluacion', 'INSERT/UPDATE', i.id_dispositivo + ' clasificado como ' + c.nombre_clasificacion, i.id_usuario_tecnico
    FROM inserted i JOIN clasificacion c ON c.id_clasificacion = i.id_clasificacion;
END;
GO

-- RN-03: un movimiento no se cierra si falta origen, destino, responsable o evidencia.
CREATE TRIGGER tr_movimiento_cierre ON movimiento
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i
               WHERE i.estado_movimiento = 'Cerrado'
                 AND (i.id_centro_origen IS NULL OR i.id_centro_destino IS NULL
                      OR i.id_usuario_coordinador IS NULL
                      OR NOT EXISTS (SELECT 1 FROM evidencia e WHERE e.id_movimiento = i.id_movimiento)))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50020, 'RN-03: el movimiento no puede cerrarse: falta origen, destino, responsable o evidencia.', 1;
    END;
END;
GO

-- RN-04 y RN-08 sobre transferencias.
CREATE TRIGGER tr_transferencia_reglas ON transferencia
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- RN-04 [CORREGIDO]: el equipo debe tener una evaluación y su clasificación
    -- más reciente debe ser compatible con el tipo de destino. Antes, un equipo
    -- SIN evaluación sí podía asignarse a un beneficiario.
    IF EXISTS (SELECT 1
               FROM inserted i
               JOIN destino de ON de.id_destino = i.id_destino
               OUTER APPLY (SELECT TOP 1 e.id_clasificacion FROM evaluacion e
                            WHERE e.id_dispositivo = i.id_dispositivo
                            ORDER BY e.fecha_evaluacion DESC, e.id_evaluacion DESC) ult
               WHERE ult.id_clasificacion IS NULL
                  OR NOT EXISTS (SELECT 1 FROM compatibilidad_destino cd
                                 WHERE cd.id_clasificacion = ult.id_clasificacion
                                   AND cd.id_tipo_destino = de.id_tipo_destino))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50030, 'RN-04: la clasificación técnica del dispositivo no permite ese destino (o no tiene evaluación).', 1;
    END;

    -- RN-08: para cerrar hace falta una evidencia de entrega.
    IF EXISTS (SELECT 1 FROM inserted i
               WHERE i.estado_cierre = 'Cerrado'
                 AND NOT EXISTS (SELECT 1 FROM evidencia e WHERE e.id_transferencia = i.id_transferencia))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50031, 'RN-08: no se puede cerrar la transferencia sin evidencia de entrega.', 1;
    END;

    INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario)
    SELECT 'transferencia', 'INSERT/UPDATE', i.id_dispositivo + ' -> ' + i.id_destino + ' (' + i.estado_cierre + ')',
           i.id_usuario_coordinador
    FROM inserted i;
END;
GO

-- RN-05: el flujo calculado por una arista no puede superar su capacidad.
-- (Que la arista sea del mismo escenario ya lo garantizan las FK.)
CREATE TRIGGER tr_resultado_arista_rn05 ON resultado_arista
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i
               JOIN arista a ON a.id_escenario = i.id_escenario AND a.nro_arista = i.nro_arista
               WHERE i.flujo_kg > a.capacidad_kg)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50040, 'RN-05: el flujo de la arista supera su capacidad.', 1;
    END;
END;
GO

-- Alerta automática: centro al 90 % o más de su capacidad (solo al cruzar el umbral).
CREATE TRIGGER tr_centro_alerta ON centro
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO alerta (id_centro, mensaje)
    SELECT i.id_centro, 'Centro ' + i.nombre_centro + ' casi lleno: '
           + CAST(i.ocupacion_actual_unidades AS VARCHAR(10)) + ' de ' + CAST(i.capacidad_unidades AS VARCHAR(10))
    FROM inserted i JOIN deleted d ON d.id_centro = i.id_centro
    WHERE i.ocupacion_actual_unidades >= 0.9 * i.capacidad_unidades
      AND d.ocupacion_actual_unidades <  0.9 * d.capacidad_unidades;
END;
GO

/* =====================================================================
   PROCEDIMIENTOS (operaciones transaccionales)
   ===================================================================== */

-- P1. Recepción: TODOS los equipos de una solicitud entran al centro (RN-06).
CREATE PROCEDURE sp_recibir_solicitud
    @id_recepcion VARCHAR(20),
    @id_solicitud VARCHAR(20),
    @id_operador  VARCHAR(20),
    @ubicacion    VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_centro VARCHAR(20), @cantidad INT;
    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @id_centro = id_centro_destino FROM solicitud
        WHERE id_solicitud = @id_solicitud AND estado_solicitud = 'Pendiente';
        IF @id_centro IS NULL
            THROW 50100, 'La solicitud no existe o ya fue recibida.', 1;

        SELECT @cantidad = COUNT(*) FROM dispositivo
        WHERE id_lote IN (SELECT id_lote FROM lote WHERE id_solicitud = @id_solicitud) AND estado_actual = 'Registrado';
        IF @cantidad = 0
            THROW 50101, 'La solicitud no tiene dispositivos registrados.', 1;

        EXEC sp_set_session_context 'id_usuario', @id_operador;

        UPDATE dispositivo
        SET id_centro_actual = @id_centro, ubicacion_centro = @ubicacion,
            fecha_ingreso_centro = SYSDATETIME(), estado_actual = 'Recolectado'
        WHERE id_lote IN (SELECT id_lote FROM lote WHERE id_solicitud = @id_solicitud) AND estado_actual = 'Registrado';

        UPDATE centro SET ocupacion_actual_unidades = ocupacion_actual_unidades + @cantidad
        WHERE id_centro = @id_centro;            -- si no hay espacio, el CHECK falla -> ROLLBACK

        INSERT INTO recepcion (id_recepcion, id_solicitud, id_usuario_operador, cantidad_recibida)
        VALUES (@id_recepcion, @id_solicitud, @id_operador, @cantidad);

        UPDATE solicitud SET estado_solicitud = 'Recibida' WHERE id_solicitud = @id_solicitud;
        UPDATE recoleccion SET fecha_realizada = SYSDATETIME() WHERE id_solicitud = @id_solicitud;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- P2. Evaluación técnica: guarda la evaluación y pasa el equipo a "Evaluado".
-- [CORREGIDO] Ya no falla en silencio si el equipo no está en Recolectado/Evaluado.
CREATE PROCEDURE sp_registrar_evaluacion
    @id_evaluacion VARCHAR(20),
    @id_dispositivo VARCHAR(20),
    @id_tecnico VARCHAR(20),
    @id_condicion VARCHAR(20),
    @id_clasificacion VARCHAR(20),
    @diagnostico VARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @estado VARCHAR(30);
    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @estado = estado_actual FROM dispositivo WITH (UPDLOCK)
        WHERE id_dispositivo = @id_dispositivo;
        IF @estado IS NULL OR @estado NOT IN ('Recolectado', 'Evaluado')
            THROW 50120, 'Solo se evalúan dispositivos en estado Recolectado (o re-evaluar uno Evaluado).', 1;

        EXEC sp_set_session_context 'id_usuario', @id_tecnico;

        INSERT INTO evaluacion (id_evaluacion, id_dispositivo, id_usuario_tecnico, id_condicion, id_clasificacion, diagnostico)
        VALUES (@id_evaluacion, @id_dispositivo, @id_tecnico, @id_condicion, @id_clasificacion, @diagnostico);  -- RN-02

        IF @estado = 'Recolectado'
            UPDATE dispositivo SET estado_actual = 'Evaluado' WHERE id_dispositivo = @id_dispositivo;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- P3. RN-06: mover un equipo de un centro a otro de forma atómica.
-- El movimiento queda "Abierto" hasta que el centro destino confirma (P4).
CREATE PROCEDURE sp_mover_dispositivo
    @id_movimiento VARCHAR(20),
    @id_dispositivo VARCHAR(20),
    @id_centro_destino VARCHAR(20),
    @ubicacion VARCHAR(30),
    @id_coordinador VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_centro_origen VARCHAR(20);
    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @id_centro_origen = id_centro_actual FROM dispositivo WITH (UPDLOCK)
        WHERE id_dispositivo = @id_dispositivo;
        IF @id_centro_origen IS NULL
            THROW 50110, 'El dispositivo no está en ningún centro.', 1;

        EXEC sp_set_session_context 'id_usuario', @id_coordinador;

        UPDATE centro SET ocupacion_actual_unidades = ocupacion_actual_unidades - 1
        WHERE id_centro = @id_centro_origen;

        UPDATE centro SET ocupacion_actual_unidades = ocupacion_actual_unidades + 1
        WHERE id_centro = @id_centro_destino;    -- centro lleno -> CHECK falla -> ROLLBACK (CP-05)
        IF @@ROWCOUNT = 0
            THROW 50111, 'El centro destino no existe.', 1;

        UPDATE dispositivo
        SET id_centro_actual = @id_centro_destino, ubicacion_centro = @ubicacion, fecha_ingreso_centro = SYSDATETIME()
        WHERE id_dispositivo = @id_dispositivo;

        INSERT INTO movimiento (id_movimiento, id_dispositivo, id_centro_origen, id_centro_destino, id_usuario_coordinador)
        VALUES (@id_movimiento, @id_dispositivo, @id_centro_origen, @id_centro_destino, @id_coordinador);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- P4. [NUEVO] RN-03: cerrar el movimiento cuando el centro destino lo recibe.
CREATE PROCEDURE sp_cerrar_movimiento
    @id_movimiento VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE movimiento
    SET estado_movimiento = 'Cerrado', fecha_recepcion = SYSDATETIME()
    WHERE id_movimiento = @id_movimiento AND estado_movimiento = 'Abierto';   -- el trigger exige evidencia
    IF @@ROWCOUNT = 0
        THROW 50112, 'El movimiento no existe o ya estaba cerrado.', 1;
END;
GO

-- P5. Asignar un destino (transferencia).
-- [CORREGIDO] El nuevo estado sale de tipo_destino (antes "Beneficiario" ponía
-- Reacondicionamiento). Reacondicionador -> Reacondicionamiento,
-- Beneficiario -> Asignado, Gestor de reciclaje -> Reciclaje, Disposición -> Disposicion.
CREATE PROCEDURE sp_asignar_destino
    @id_transferencia VARCHAR(20),
    @id_dispositivo VARCHAR(20),
    @id_destino VARCHAR(20),
    @id_coordinador VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_centro VARCHAR(20), @nuevo_estado VARCHAR(30);
    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @id_centro = id_centro_actual FROM dispositivo WITH (UPDLOCK)
        WHERE id_dispositivo = @id_dispositivo;

        SELECT @nuevo_estado = td.estado_resultante
        FROM destino de JOIN tipo_destino td ON td.id_tipo_destino = de.id_tipo_destino
        WHERE de.id_destino = @id_destino;
        IF @nuevo_estado IS NULL
            THROW 50130, 'El destino no existe.', 1;

        EXEC sp_set_session_context 'id_usuario', @id_coordinador;

        -- RN-04 lo valida el trigger; el índice filtrado impide 2 transferencias abiertas.
        INSERT INTO transferencia (id_transferencia, id_dispositivo, id_destino, id_usuario_coordinador)
        VALUES (@id_transferencia, @id_dispositivo, @id_destino, @id_coordinador);

        -- Sale del inventario del centro (si todavía estaba en uno).
        IF @id_centro IS NOT NULL
        BEGIN
            UPDATE centro SET ocupacion_actual_unidades = ocupacion_actual_unidades - 1 WHERE id_centro = @id_centro;
            UPDATE dispositivo SET id_centro_actual = NULL, ubicacion_centro = NULL, fecha_ingreso_centro = NULL
            WHERE id_dispositivo = @id_dispositivo;
        END;

        -- El trigger de estados valida la transición (p. ej. Beneficiario solo
        -- después de Reacondicionamiento).
        UPDATE dispositivo SET estado_actual = @nuevo_estado WHERE id_dispositivo = @id_dispositivo;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- P6. [NUEVO] El reacondicionador o reciclador registra el tratamiento.
-- Reciclaje -> el equipo pasa a "Valorizado".
CREATE PROCEDURE sp_registrar_tratamiento
    @id_tratamiento VARCHAR(20),
    @id_transferencia VARCHAR(20),
    @id_responsable VARCHAR(20),
    @tipo_tratamiento VARCHAR(30),
    @resultado VARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_dispositivo VARCHAR(20), @estado VARCHAR(30);
    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @id_dispositivo = t.id_dispositivo, @estado = d.estado_actual
        FROM transferencia t JOIN dispositivo d ON d.id_dispositivo = t.id_dispositivo
        WHERE t.id_transferencia = @id_transferencia;

        IF NOT (   (@tipo_tratamiento = 'Reacondicionamiento'    AND @estado = 'Reacondicionamiento')
                OR (@tipo_tratamiento = 'Reciclaje'              AND @estado = 'Reciclaje')
                OR (@tipo_tratamiento = 'Disposicion_controlada' AND @estado = 'Disposicion'))
            THROW 50140, 'El tipo de tratamiento no corresponde al estado del dispositivo.', 1;

        EXEC sp_set_session_context 'id_usuario', @id_responsable;

        INSERT INTO tratamiento (id_tratamiento, id_transferencia, id_usuario_responsable, tipo_tratamiento, resultado)
        VALUES (@id_tratamiento, @id_transferencia, @id_responsable, @tipo_tratamiento, @resultado);

        IF @tipo_tratamiento = 'Reciclaje'
            UPDATE dispositivo SET estado_actual = 'Valorizado' WHERE id_dispositivo = @id_dispositivo;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- P7. [NUEVO] El destino confirma la recepción: cierra la transferencia (RN-08).
CREATE PROCEDURE sp_confirmar_transferencia
    @id_transferencia VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE transferencia
    SET estado_cierre = 'Cerrado', fecha_confirmacion_cierre = SYSDATETIME()
    WHERE id_transferencia = @id_transferencia AND estado_cierre = 'Pendiente_Evidencia';   -- el trigger exige evidencia
    IF @@ROWCOUNT = 0
        THROW 50150, 'La transferencia no existe o ya estaba cerrada.', 1;
END;
GO

-- P8. RN-08: cerrar la trazabilidad. Requiere destino final (Asignado,
-- Valorizado o Disposicion) y la última transferencia confirmada con fecha.
CREATE PROCEDURE sp_cerrar_trazabilidad
    @id_dispositivo VARCHAR(20),
    @id_usuario VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dispositivo
                       WHERE id_dispositivo = @id_dispositivo
                         AND estado_actual IN ('Asignado', 'Valorizado', 'Disposicion'))
            THROW 50160, 'RN-08: el dispositivo no tiene un destino final.', 1;

        IF NOT EXISTS (SELECT 1 FROM (SELECT TOP 1 t.estado_cierre FROM transferencia t
                                      WHERE t.id_dispositivo = @id_dispositivo
                                      ORDER BY t.fecha_transferencia DESC, t.id_transferencia DESC) ult
                       WHERE ult.estado_cierre = 'Cerrado')
            THROW 50161, 'RN-08: la transferencia final aún no tiene confirmación de recepción.', 1;

        EXEC sp_set_session_context 'id_usuario', @id_usuario;
        UPDATE dispositivo SET estado_actual = 'Cerrado' WHERE id_dispositivo = @id_dispositivo;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- P9. Indicadores del mes (datos derivados).
CREATE PROCEDURE sp_calcular_indicadores
    @periodo CHAR(7)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DELETE FROM indicador WHERE periodo = @periodo;

        INSERT INTO indicador (nombre, periodo, valor)
        SELECT 'Equipos en inventario', @periodo, COUNT(*) FROM dispositivo WHERE id_centro_actual IS NOT NULL
        UNION ALL
        SELECT 'Capacidad utilizada (%)', @periodo,
               CAST(100.0 * SUM(ocupacion_actual_unidades) / SUM(capacidad_unidades) AS DECIMAL(12,2)) FROM centro
        UNION ALL
        SELECT 'Trazabilidad completa (%)', @periodo,
               CAST(100.0 * SUM(CASE WHEN estado_actual = 'Cerrado' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(12,2))
        FROM dispositivo
        UNION ALL
        SELECT 'Kg recuperados (reutilizados + valorizados)', @periodo, ISNULL(SUM(d.peso_kg), 0)
        FROM dispositivo d
        WHERE EXISTS (SELECT 1 FROM historial h WHERE h.id_dispositivo = d.id_dispositivo
                      AND h.estado_nuevo IN ('Asignado', 'Valorizado'));

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- P10. [NUEVO] Guarda una ejecución del algoritmo (la llama el módulo /math).
-- Recibe el flujo por arista como JSON: [{"nro_arista":1,"flujo_kg":40,"en_corte_minimo":1}, ...]
-- [CAMBIO v5] El número de ejecución se calcula solo (1, 2, 3... por escenario).
CREATE PROCEDURE sp_guardar_resultado_flujo
    @id_escenario VARCHAR(20),
    @flujo_maximo_kg DECIMAL(12,2),
    @aristas_json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @nro INT = ISNULL((SELECT MAX(nro_ejecucion) FROM resultado WITH (UPDLOCK, HOLDLOCK)
                                   WHERE id_escenario = @id_escenario), 0) + 1;
        INSERT INTO resultado (id_escenario, nro_ejecucion, flujo_maximo_kg)
        VALUES (@id_escenario, @nro, @flujo_maximo_kg);

        INSERT INTO resultado_arista (id_escenario, nro_ejecucion, nro_arista, flujo_kg, en_corte_minimo)
        SELECT @id_escenario, @nro, j.nro_arista, j.flujo_kg, j.en_corte_minimo
        FROM OPENJSON(@aristas_json)
             WITH (nro_arista INT, flujo_kg DECIMAL(10,2), en_corte_minimo BIT) j;   -- RN-05 por trigger
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

/* =====================================================================
   VISTAS
   ===================================================================== */

-- Línea de vida de cada dispositivo (RF-INT-03, CP-14).
CREATE VIEW vw_trazabilidad AS
SELECT h.id_dispositivo, h.nro_cambio, h.estado_anterior, h.estado_nuevo, h.fecha_cambio,
       u.nombres + ' ' + u.apellidos AS responsable, r.nombre_rol
FROM historial h
JOIN usuario u ON u.id_usuario = h.id_usuario_responsable
JOIN rol r ON r.id_rol = u.id_rol;
GO

-- Inventario actual por centro.
CREATE VIEW vw_inventario AS
SELECT c.nombre_centro, d.id_dispositivo, cat.nombre_categoria, d.peso_kg,
       d.ubicacion_centro, d.estado_actual, d.fecha_ingreso_centro
FROM dispositivo d
JOIN centro c ON c.id_centro = d.id_centro_actual
JOIN categoria cat ON cat.id_categoria = d.id_categoria;
GO

-- Verificación del dato derivado: ocupación guardada vs. ocupación real.
CREATE VIEW vw_ocupacion_centro AS
SELECT c.id_centro, c.nombre_centro, c.capacidad_unidades,
       c.ocupacion_actual_unidades AS ocupacion_guardada,
       (SELECT COUNT(*) FROM dispositivo d WHERE d.id_centro_actual = c.id_centro) AS ocupacion_real,
       (SELECT ISNULL(SUM(d.peso_kg), 0) FROM dispositivo d WHERE d.id_centro_actual = c.id_centro) AS kg_en_centro
FROM centro c;
GO

-- Kg evaluados que esperan destino en cada centro: es la OFERTA que se usa
-- como capacidad de las aristas FUENTE -> centro en el modelo de flujo.
CREATE VIEW vw_oferta_kg_centro AS
SELECT n.id_nodo, c.id_centro, c.nombre_centro,
       ISNULL(SUM(d.peso_kg), 0) AS kg_pendientes
FROM centro c
JOIN nodo n ON n.id_centro = c.id_centro
LEFT JOIN dispositivo d ON d.id_centro_actual = c.id_centro AND d.estado_actual = 'Evaluado'
GROUP BY n.id_nodo, c.id_centro, c.nombre_centro;
GO

-- Red de cada escenario para el algoritmo de flujo máximo (RF-INT-04).
CREATE VIEW vw_red AS
SELECT a.id_escenario, e.id_nodo_fuente, e.id_nodo_sumidero, a.nro_arista,
       a.id_nodo_origen, no.nombre_nodo AS nombre_origen,
       a.id_nodo_destino, nd.nombre_nodo AS nombre_destino, a.capacidad_kg
FROM arista a
JOIN escenario e ON e.id_escenario = a.id_escenario
JOIN nodo no ON no.id_nodo = a.id_nodo_origen
JOIN nodo nd ON nd.id_nodo = a.id_nodo_destino;
GO

-- Resultado de la última ejecución: flujo por arista, saturación y corte mínimo.
CREATE VIEW vw_resultado_flujo AS
SELECT r.id_escenario, r.nro_ejecucion, r.flujo_maximo_kg, ra.nro_arista,
       v.nombre_origen, v.nombre_destino, v.capacidad_kg, ra.flujo_kg,
       CAST(100.0 * ra.flujo_kg / v.capacidad_kg AS DECIMAL(5,1)) AS uso_pct,
       CASE WHEN ra.flujo_kg = v.capacidad_kg THEN 1 ELSE 0 END AS saturada,
       ra.en_corte_minimo
FROM resultado r
JOIN resultado_arista ra ON ra.id_escenario = r.id_escenario AND ra.nro_ejecucion = r.nro_ejecucion
JOIN vw_red v ON v.id_escenario = ra.id_escenario AND v.nro_arista = ra.nro_arista;
GO

/* =====================================================================
   ROLES DE BASE DE DATOS (RN-07, mínimo privilegio)
   ===================================================================== */
CREATE ROLE rol_operador;
CREATE ROLE rol_tecnico;
CREATE ROLE rol_coordinador;
CREATE ROLE rol_destino;        -- reacondicionador / reciclador
CREATE ROLE rol_consulta;
GRANT EXECUTE ON sp_recibir_solicitud TO rol_operador;
GRANT EXECUTE ON sp_registrar_tratamiento TO rol_destino;
GRANT SELECT ON vw_inventario TO rol_operador;
GRANT EXECUTE ON sp_registrar_evaluacion TO rol_tecnico;
GRANT SELECT, INSERT ON evidencia TO rol_tecnico;
GRANT SELECT ON evidencia TO rol_coordinador;
GRANT EXECUTE ON sp_mover_dispositivo TO rol_coordinador;
GRANT EXECUTE ON sp_cerrar_movimiento TO rol_coordinador;
GRANT EXECUTE ON sp_asignar_destino TO rol_coordinador;
GRANT EXECUTE ON sp_confirmar_transferencia TO rol_coordinador;
GRANT EXECUTE ON sp_cerrar_trazabilidad TO rol_coordinador;
GRANT SELECT ON vw_red TO rol_coordinador;
GRANT SELECT ON vw_resultado_flujo TO rol_coordinador;
GRANT SELECT ON vw_trazabilidad TO rol_consulta;
DENY SELECT ON evidencia TO rol_consulta;
GO
