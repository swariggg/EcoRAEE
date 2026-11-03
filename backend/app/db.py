"""Conexión a SQL Server con pyodbc y funciones de ayuda para consultar."""
from contextlib import contextmanager

import pyodbc

from . import config

_PREFERIDOS = ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "SQL Server"]


def driver_odbc() -> str:
    if config.DB_DRIVER:
        return config.DB_DRIVER
    instalados = pyodbc.drivers()
    for d in _PREFERIDOS:
        if d in instalados:
            return d
    raise RuntimeError(
        "No se encontró un driver ODBC para SQL Server. Instale 'ODBC Driver 18 for SQL Server'."
    )


def cadena_conexion() -> str:
    drv = driver_odbc()
    partes = [f"DRIVER={{{drv}}}", f"SERVER={config.DB_SERVER}", f"DATABASE={config.DB_NAME}"]
    if config.DB_TRUSTED:
        partes.append("Trusted_Connection=yes")
    else:
        partes += [f"UID={config.DB_USER}", f"PWD={config.DB_PASSWORD}"]
    if drv.startswith("ODBC Driver 1"):
        # SQL Server local usa un certificado autofirmado.
        partes += ["Encrypt=yes", "TrustServerCertificate=yes"]
    return ";".join(partes) + ";"


def conectar() -> pyodbc.Connection:
    cn = pyodbc.connect(cadena_conexion(), autocommit=True, timeout=10)
    return cn


def get_db():
    """Dependencia de FastAPI: una conexión por petición."""
    cn = conectar()
    try:
        yield cn
    finally:
        cn.close()


def _filas(cur) -> list[dict]:
    if cur.description is None:
        return []
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, fila)) for fila in cur.fetchall()]


def todos(cn, sql: str, *params) -> list[dict]:
    cur = cn.cursor()
    cur.execute(sql, params)
    return _filas(cur)


def uno(cn, sql: str, *params) -> dict | None:
    r = todos(cn, sql, *params)
    return r[0] if r else None


def ejecutar(cn, sql: str, *params) -> int:
    cur = cn.cursor()
    cur.execute(sql, params)
    n = cur.rowcount
    # Consumir resultados intermedios (procedimientos con varios SELECT/mensajes).
    while cur.nextset():
        pass
    return n


@contextmanager
def transaccion(cn):
    """Agrupa varias sentencias en una sola transacción (todo o nada)."""
    cn.autocommit = False
    try:
        yield cn
        cn.commit()
    except Exception:
        cn.rollback()
        raise
    finally:
        cn.autocommit = True


def siguiente_id(cn, tabla: str, columna: str, prefijo: str, ancho: int = 3) -> str:
    """Genera el siguiente código (p. ej. S-005) a partir del mayor número existente.

    tabla y columna vienen siempre del código (nunca del usuario).
    """
    fila = uno(
        cn,
        f"SELECT MAX(TRY_CAST(SUBSTRING({columna}, ?, 20) AS INT)) AS n "
        f"FROM {tabla} WITH (UPDLOCK, HOLDLOCK) WHERE {columna} LIKE ?",
        len(prefijo) + 1, prefijo + "%",
    )
    n = (fila["n"] or 0) + 1
    return f"{prefijo}{str(n).zfill(ancho)}"
