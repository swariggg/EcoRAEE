# EcoRAEE Cloud

**EcoRAEE Cloud** es un sistema desarrollado para gestionar y dar seguimiento a los residuos de aparatos eléctricos y electrónicos (RAEE) generados en la universidad.

El proyecto cuenta con una versión local funcional que incluye la interfaz web, el servidor y la base de datos.

## Estructura del proyecto

El repositorio está organizado en las siguientes carpetas:

| Carpeta | Descripción |
|---|---|
| `frontend/` | Contiene la parte visual del sistema, desarrollada con HTML, CSS y JavaScript. Incluye el inicio de sesión, paneles y formularios según el rol de cada usuario. |
| `backend/` | Contiene el servidor desarrollado en Python con FastAPI. Se encarga de procesar las solicitudes y aplicar las reglas del sistema. |
| `database/` | Incluye los scripts de la base de datos para SQL Server 2022, junto con datos de prueba y consultas. |
| `infrastructure/aws/` | Contiene la propuesta de arquitectura para una futura implementación en AWS. |
| `docs/` | Incluye las instrucciones de instalación, funcionamiento y uso del sistema. |
| `math/`, `innovation/`, `evidence/` | Carpetas destinadas a los demás componentes del proyecto integrador. |

## ¿Cómo funciona el sistema?

El sistema funciona de manera local y conecta tres componentes principales:

1. **Frontend:** es la interfaz que utiliza el usuario para ingresar al sistema y realizar las diferentes actividades.
2. **Backend:** procesa la información, valida los datos y controla los permisos de cada usuario.
3. **Base de datos:** almacena los usuarios, registros, equipos y demás información del proceso RAEE.

Para esta versión se utilizan las siguientes tecnologías:

- **Frontend:** HTML, CSS y JavaScript.
- **Backend:** Python con FastAPI.
- **Base de datos:** SQL Server 2022.
- **Conexión:** API REST y ODBC.
- **Seguridad:** contraseñas protegidas con bcrypt, autenticación mediante JWT y permisos según el rol del usuario.
- **Archivos:** almacenamiento local de evidencias y documentos.

Además, el sistema incluye un algoritmo de Edmonds-Karp, utilizado para calcular el flujo máximo dentro de la red logística de gestión de residuos.

## Instalación y ejecución

Para ejecutar el proyecto en un equipo local, primero se debe preparar la base de datos y después iniciar el servidor.

Los pasos completos se encuentran en el archivo `docs/GUIA_EJECUCION.md`.

A continuación, se muestran los pasos principales:

**1. Preparar la base de datos**

Desde SQL Server Management Studio (SSMS), ejecutar los siguientes scripts:

- `database/01_esquema.sql`
- `database/02_datos.sql`
- `database/05_usuarios_demo.sql`

**2. Preparar el backend**

Abrir una terminal y ejecutar:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

**3. Iniciar el servidor**

```bash
fastapi dev
```

**4. Abrir el sistema**

Una vez iniciado el servidor, ingresar desde el navegador a:

`http://localhost:8000`

## Usuarios de prueba

El sistema incluye varias cuentas para probar las funciones de cada rol.

Todas utilizan la misma contraseña: `EcoRaee2026!`.

| Correo electrónico | Rol |
|---|---|
| `admin@ecoraee.test` | Administrador |
| `gen1@ecoraee.test` | Generador (estudiante) |
| `ope1@ecoraee.test` | Operador de centro |
| `tec1@ecoraee.test` | Técnico evaluador |
| `coo1@ecoraee.test` | Coordinador logístico |
| `rea1@ecoraee.test` | Reacondicionador |
| `rec1@ecoraee.test` | Gestor de reciclaje |
| `ben1@ecoraee.test` | Beneficiario |
| `tec2@ecoraee.test` | Técnico inactivo (cuenta utilizada para realizar pruebas de acceso) |

*Nota: Estas cuentas son únicamente para pruebas en el entorno local.*

## Pruebas del sistema

Para comprobar que el backend funciona correctamente, se pueden ejecutar las pruebas automatizadas con el siguiente comando:

```bash
cd backend
python -m pytest -v
```

El proyecto cuenta con 12 pruebas de integración que permiten verificar diferentes funcionalidades, entre ellas:

- Inicio de sesión y permisos según el rol.
- Creación, consulta, actualización y eliminación de registros.
- Validación de datos y relaciones entre tablas.
- Seguimiento del proceso completo de un equipo.
- Control de capacidad y reversión de operaciones cuando se incumple la regla RN-06.
- Cálculo de flujo máximo en cinco escenarios diferentes.

## Créditos

Las ilustraciones utilizadas en el sistema fueron creadas especialmente para este proyecto y se encuentran en `frontend/assets/img/` y `frontend/js/ilustraciones.js`.

Para los textos se utilizan las fuentes **Fraunces** y **Plus Jakarta Sans**, obtenidas de Google Fonts y distribuidas bajo licencia OFL.
