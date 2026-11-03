"""Manejo de errores: convierte los errores de SQL Server y de validación en
respuestas JSON claras en español: {"detalle": "...", "codigo": ...}."""
import logging
import re

import pyodbc
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("ecoraee")

# Mensajes amigables para las restricciones CHECK con nombre.
RESTRICCIONES = {
    "ck_centro_capacidad": "RN-06: el centro no tiene capacidad disponible (o la nueva capacidad es menor que su ocupación).",
    "ck_rn08_fecha": "RN-08: no se puede cerrar la transferencia sin fecha de confirmación.",
    "ck_movimiento_fecha": "RN-03: un movimiento cerrado necesita fecha de recepción.",
    "chk_evidencia_origen": "La evidencia debe respaldar exactamente una operación.",
}

_NUM = re.compile(r"\((\d+)\)\s*\(SQL")


def _mensaje_sql(exc: pyodbc.Error) -> tuple[int | None, str]:
    texto = str(exc.args[1] if len(exc.args) > 1 else exc)
    m = _NUM.search(texto)
    numero = int(m.group(1)) if m else None
    # El primer mensaje del servidor está después de "[SQL Server]".
    msg = texto.split("[SQL Server]")[1] if "[SQL Server]" in texto else texto
    msg = _NUM.split(msg)[0].strip()
    return numero, msg


def traducir_error_sql(exc: pyodbc.Error) -> tuple[int, str, int | None]:
    numero, msg = _mensaje_sql(exc)
    estado = exc.args[0] if exc.args else ""
    if isinstance(exc, (pyodbc.OperationalError, pyodbc.InterfaceError)) or str(estado).startswith("08"):
        return 503, "No se pudo conectar con SQL Server. Revise que el servicio esté encendido y el archivo .env.", numero
    if numero and 50000 <= numero < 51000:
        return 409, msg, numero                       # regla de negocio (THROW de triggers y procedimientos)
    if numero in (2627, 2601):
        return 409, "Ya existe un registro con ese valor (dato duplicado).", numero
    if numero == 547:
        if "DELETE" in msg:
            return 409, "No se puede eliminar: hay otros registros que dependen de este.", numero
        if "FOREIGN KEY" in msg:
            return 400, "Uno de los datos hace referencia a un registro que no existe.", numero
        if "CHECK" in msg:
            # Se busca el nombre de la restricción sin depender del idioma de SQL Server
            # (en inglés: constraint "x"; en español: restricción CHECK "x").
            nombre = next((n for n in RESTRICCIONES if n in msg), "")
            if nombre:
                return 409, RESTRICCIONES[nombre], numero
            restr = re.search(r"""CHECK\s*(?:constraint\s*)?["'«]([^"'»]+)""", msg)
            nombre = restr.group(1) if restr else ""
            return 400, f"Un dato no cumple las reglas de la base de datos ({nombre}).", numero
    if numero == 3609:
        return 409, "La operación fue revertida por una regla de negocio.", numero
    log.exception("Error SQL no controlado")
    return 500, "Error en la base de datos.", numero


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(pyodbc.Error)
    async def _sql(_: Request, exc: pyodbc.Error):
        status, msg, numero = traducir_error_sql(exc)
        return JSONResponse(status_code=status, content={"detalle": msg, "codigo": numero})

    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detalle": exc.detail},
                            headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, exc: RequestValidationError):
        campos = []
        for e in exc.errors():
            loc = ".".join(str(x) for x in e.get("loc", []) if x not in ("body", "query", "path"))
            campos.append({"campo": loc, "mensaje": e.get("msg", "")})
        return JSONResponse(status_code=422, content={"detalle": "Datos inválidos.", "campos": campos})

    @app.exception_handler(Exception)
    async def _otro(_: Request, exc: Exception):
        log.exception("Error no controlado")
        return JSONResponse(status_code=500, content={"detalle": "Error interno del servidor."})
