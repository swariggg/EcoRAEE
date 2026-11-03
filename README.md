# EcoRAEE Cloud

Sistema de trazabilidad de residuos de aparatos eléctricos y electrónicos (RAEE) de la universidad.
Proyecto Integrador UIDE · Ariana Remache, Elianna Suasnavas y Martín Calahorrano.

**Segundo avance:** versión local y funcional (frontend + API + base de datos). Nada se despliega en AWS en esta fase.

## Qué hay en el repositorio

| Carpeta | Contenido |
|---|---|
| `frontend/` | Interfaz web en HTML, CSS y JavaScript (sin frameworks). Login, panel y pantallas CRUD por rol. |
| `backend/` | API REST en Python con FastAPI. Validaciones, reglas de negocio, manejo de errores y pruebas de integración. |
| `database/` | Base de datos v5 para SQL Server: esquema, datos de prueba, pruebas SQL, consultas y diagramas. |
| `infrastructure/aws/` | Diseño de la arquitectura en AWS (para la fase de despliegue, no se usa en local). |
| `docs/` | Guía de ejecución, roles y endpoints. |
| `math/`, `innovation/`, `evidence/` | Componentes del integrador que se completan después. |

## Arquitectura local

```
Navegador ──HTTP──> FastAPI (localhost:8000) ──ODBC──> SQL Server (localhost, EcoRaEE_CLOUD)
   │                     │
   └── frontend/ servido por la misma API      └── backend/uploads/ (evidencias en local)
```

- **Frontend:** SPA en JavaScript con rutas `#/...`, formularios con validación en el cliente y mensajes del servidor por campo.
- **Backend:** FastAPI + pyodbc. Contraseñas con bcrypt, sesión con JWT, permisos por rol, auditoría de acciones.
- **Base de datos:** SQL Server con PK, FK, CHECK, UNIQUE, triggers (RN-01 a RN-08) y procedimientos almacenados transaccionales.
- **Flujo máximo:** algoritmo de Edmonds-Karp sobre la red logística (`backend/app/flujo.py`), con corte mínimo.

## Cómo ejecutarlo

Los pasos completos están en **[docs/GUIA_EJECUCION.md](docs/GUIA_EJECUCION.md)**. En resumen:

```bash
# 1. En SSMS ejecutar: database/01_esquema.sql, 02_datos.sql y 05_usuarios_demo.sql
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
copy .env.example .env            # Windows (cp en Linux/Mac)
python -m uvicorn app.main:app --reload
# 2. Abrir http://localhost:8000
```

Usuarios de prueba (todos con la contraseña `EcoRaee2026!`, solo para la base local):

| Correo | Rol |
|---|---|
| admin@ecoraee.test | Administrador |
| gen1@ecoraee.test | Generador (estudiante) |
| ope1@ecoraee.test | Operador de centro |
| tec1@ecoraee.test | Técnico evaluador |
| coo1@ecoraee.test | Coordinador logístico |
| rea1@ecoraee.test | Reacondicionador |
| rec1@ecoraee.test | Gestor de reciclaje |
| ben1@ecoraee.test | Beneficiario |
| tec2@ecoraee.test | Técnico inactivo (no puede entrar, sirve para probar) |

## Pruebas

```bash
cd backend
python -m pytest -v
```

12 pruebas de integración contra la base real: login y roles, CRUD con integridad referencial,
validaciones, ciclo completo de un equipo, rollback por capacidad (RN-06) y flujo máximo de los 5 escenarios.

## Créditos de imágenes

Las ilustraciones (`frontend/assets/img/` y `frontend/js/ilustraciones.js`) son SVG originales hechos para este proyecto.
Las fuentes son Fraunces y Plus Jakarta Sans de Google Fonts (licencia OFL).
