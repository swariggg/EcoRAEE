"""EcoRAEE Cloud - API local (FastAPI).

Ejecutar desde la carpeta backend/:
    uvicorn app.main:app --reload
y abrir http://localhost:8000 (frontend) o http://localhost:8000/docs (documentación de la API).
"""
import logging
import time

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import config
from .db import driver_odbc, get_db, uno
from .errores import registrar_manejadores
from .routers import admin, auth, catalogos, dispositivos, evidencias, panel, procesos, red, solicitudes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="EcoRAEE Cloud API",
    version="0.2.0",
    description="API local del segundo avance: trazabilidad de RAEE con SQL Server.",
)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["Authorization", "Content-Type"])
registrar_manejadores(app)


log = logging.getLogger("ecoraee")


@app.middleware("http")
async def cache_y_tiempos(request, call_next):
    """Mide cada petición y evita archivos viejos del frontend.

    - Cabecera Server-Timing: en F12 > Red > Tiempos se ve cuánto tardó la API.
    - Peticiones de más de 1 s quedan avisadas en la consola de uvicorn.
    - El navegador revalida HTML, CSS y JS en cada carga (304 si no cambiaron).
    """
    inicio = time.perf_counter()
    respuesta = await call_next(request)
    ms = (time.perf_counter() - inicio) * 1000
    respuesta.headers["Server-Timing"] = f"app;dur={ms:.0f}"
    if ms > 1000:
        log.warning("Petición lenta: %s %s tardó %.0f ms", request.method, request.url.path, ms)
    if not request.url.path.startswith("/api"):
        respuesta.headers["Cache-Control"] = "no-cache"
    return respuesta

for r in (auth, catalogos, admin, solicitudes, dispositivos, procesos, evidencias, red, panel):
    app.include_router(r.router)


@app.get("/api/health", tags=["Salud"])
def salud(cn=Depends(get_db)):
    """El balanceador (en AWS) usará este endpoint para saber si la API responde."""
    fila = uno(cn, "SELECT DB_NAME() AS base, @@VERSION AS version")
    return {"estado": "ok", "base": fila["base"], "driver": driver_odbc(),
            "sql_server": fila["version"].split("\n")[0]}


# El frontend (HTML + JS) se sirve desde la misma API: http://localhost:8000
if config.FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
