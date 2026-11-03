# Guía de ejecución local · EcoRAEE Cloud (Segundo avance)

Todo corre en su computadora: SQL Server, la API en Python y el frontend. No se usa AWS.

## 1. Requisitos

| Programa | Para qué | Cómo comprobarlo |
|---|---|---|
| SQL Server (Express o Developer) + SSMS | Base de datos | Abrir SSMS y conectarse a `localhost` con autenticación de Windows |
| Python 3.10 o superior | API | `python --version` |
| Microsoft ODBC Driver 18 (o 17) for SQL Server | Conexión de Python a SQL Server | Buscar "ODBC Data Sources (64-bit)" → pestaña Drivers |
| Git | Repositorio | `git --version` |
| Navegador moderno | Frontend | Chrome, Edge o Firefox |

Node.js **no** es necesario: el frontend es HTML, CSS y JavaScript puro y lo sirve la misma API.

Si falta el ODBC Driver 18, descárguelo de Microsoft ("Download ODBC Driver for SQL Server") e instale la versión x64.

## 2. Crear la base de datos

En SSMS, conectado a `localhost` con autenticación de Windows, abra y ejecute **en este orden** (botón Execute o F5):

1. `database/01_esquema.sql` → crea la base `EcoRaEE_CLOUD` con tablas, restricciones, triggers, vistas y procedimientos. **Si la base ya existe, la borra y la vuelve a crear.**
2. `database/02_datos.sql` → datos de prueba (organizaciones, centros, equipos, evaluaciones, red logística y 5 escenarios).
3. `database/05_usuarios_demo.sql` → pone la contraseña `EcoRaee2026!` a los usuarios de prueba.
4. `database/06_rendimiento.sql` → solo si la base se creó antes del 3 de noviembre: apaga AUTO_CLOSE (los scripts nuevos ya lo hacen).

Opcionales: `03_pruebas.sql` (pruebas de reglas de negocio en SQL) y `04_consultas.sql` (consultas del informe).
Si quiere conservar una base existente, use `01_esquema_sin_borrar.sql` en lugar de `01_esquema.sql`.

Para volver al estado inicial en cualquier momento, ejecute de nuevo 01 → 02 → 05.

## 3. Preparar y arrancar la API

En una terminal (PowerShell o CMD) dentro de la carpeta del repositorio:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app
```

- Con autenticación de Windows y servidor `localhost` **no hay que cambiar nada** en `.env`.
- Si su instancia tiene nombre (por ejemplo `localhost\SQLEXPRESS`), cambie `DB_SERVER` en `.env`.
- Opcional: ponga una clave en `JWT_SECRET` (`python -c "import secrets; print(secrets.token_urlsafe(48))"`). Si se deja vacía, se genera una temporal y las sesiones se cierran al reiniciar la API.
- Si PowerShell no deja activar el entorno, ejecute una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Compruebe la conexión en http://localhost:8000/api/health (debe decir `"estado":"ok"`).

## 4. Usar la aplicación

Abra **http://localhost:8000**. En la pantalla de ingreso puede elegir un usuario de prueba de la lista
(se llena la contraseña sola). Todos usan `EcoRaee2026!`.

La documentación interactiva de todos los endpoints está en **http://localhost:8000/docs** (Swagger).

### Recorrido sugerido para la demostración

1. **gen1** (Generador): Solicitudes → Nueva solicitud con 2 equipos. Ver el código QR y el estado *Registrado*.
2. **ope1** (Operador): abrir la solicitud → Programar recolección → Recibir. Los equipos pasan a *Recolectado*.
3. **tec1** (Técnico): Evaluaciones → Evaluar uno de los equipos. Pasa a *Evaluado*.
4. **coo1** (Coordinador): en el equipo → Asignar destino (solo aparecen destinos compatibles, RN-04) → subir evidencia → confirmar.
5. **coo1**: Red y flujo máximo → Ejecutar algoritmo en ESC-1 (140 kg) y ESC-5 (180 kg). Ver corte mínimo.
6. **admin**: Usuarios, Catálogos (intentar borrar una marca en uso → error de integridad), Auditoría.

## 5. Pruebas automáticas

Con la API detenida o en marcha (no importa) y la base cargada:

```powershell
cd backend
.venv\Scripts\activate
python -m pytest -v
```

Las 12 pruebas crean sus propios datos y los dejan registrados; si quiere una base limpia, vuelva a ejecutar 01 → 02 → 05.

## 6. Roles y permisos

| Pantalla | GEN | OPE | TEC | COO | REA / BEN | ADM |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Inicio (panel) | propio | ✓ | ✓ | ✓ | ✓ | ✓ |
| Solicitudes | crear / ver las suyas | recolectar y recibir | | ver y gestionar | | ✓ |
| Dispositivos | solo los suyos | ✓ | ✓ | ✓ | ✓ | ✓ |
| Evaluaciones | | ver | registrar / corregir | ver | | ✓ |
| Movimientos | | ver | | crear / cerrar | | ✓ |
| Destinos asignados | | | | asignar / confirmar | ver los de su organización, registrar tratamiento | ✓ |
| Evidencias | | subir | subir | subir, ver restringidas | subir | ✓ |
| Red y flujo máximo | | ver | ver | crear escenarios y ejecutar | | ✓ |
| Centros, destinos, catálogos | | ver | ver | destinos | | CRUD |
| Usuarios, auditoría | | | | | | ✓ |

El backend aplica estos permisos en cada endpoint (no solo oculta el menú): una llamada sin permiso responde 403.

## 7. Reglas de borrado

- **Catálogos** (categorías, marcas, condiciones, tipos de centro, organizaciones): se pueden borrar solo si nadie los usa; si no, la API responde 409.
- **Usuarios:** no se borran, se desactivan (se conserva su historial y auditoría). Un administrador no puede desactivarse a sí mismo.
- **Solicitudes:** se cancelan (estado *Cancelada*) mientras no se hayan recibido.
- **Dispositivos, evaluaciones, movimientos, transferencias, evidencias, historial:** no se borran; son la trazabilidad. Solo se corrigen mientras el paso sigue abierto.
- **Escenarios de red:** se pueden borrar con sus aristas; si ya tienen ejecuciones, solo se pueden cambiar capacidades o añadir aristas.

## 8. Errores comunes

| Mensaje | Solución |
|---|---|
| `Data source name not found` / `IM002` | Falta el ODBC Driver 17 o 18. Instálelo (x64). |
| `Login failed` / `Cannot open database` | No se ejecutó `01_esquema.sql`, o `DB_SERVER` no coincide con el nombre de su instancia. |
| `/api/health` responde error de certificado | Ya se usa `TrustServerCertificate=yes`; revise que sea el driver 18 o 17. |
| No puedo entrar con los usuarios | Falta ejecutar `05_usuarios_demo.sql`. |
| La página carga pero sin datos | La API no está corriendo o el puerto no es 8000. |
| Todo carga lento | 1) Ejecute una vez `database/06_rendimiento.sql` (apaga AUTO_CLOSE de SQL Server Express). 2) Arranque uvicorn **sin** `--reload`: vigilar archivos dentro de OneDrive vuelve lenta la API. 3) En F12 › Red, la columna Tiempos muestra `app` = lo que tardó la API; en la consola de uvicorn aparecen las peticiones de más de 1 s. |
