"""Login con bcrypt + JWT y control de acceso por rol (RF-INT-01, CP-01)."""
import logging
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config
from .db import get_db, uno

log = logging.getLogger("ecoraee")

_SECRETO = config.JWT_SECRET or secrets.token_urlsafe(48)
if not config.JWT_SECRET:
    log.warning("JWT_SECRET vacío en .env: se generó uno temporal (las sesiones se pierden al reiniciar).")

ROLES = {
    "ADM": "Administrador",
    "GEN": "Generador",
    "OPE": "Operador de centro",
    "TEC": "Técnico evaluador",
    "COO": "Coordinador logístico",
    "REA": "Reacondicionador/reciclador",
    "BEN": "Entidad beneficiaria",
}
PERSONAL = ("ADM", "OPE", "TEC", "COO", "REA", "BEN")      # todos menos el generador

_bearer = HTTPBearer(auto_error=False)
_intentos: dict[str, deque] = defaultdict(deque)


def hash_password(clave: str) -> str:
    return bcrypt.hashpw(clave.encode(), bcrypt.gensalt(12)).decode()


def verificar_password(clave: str, hash_guardado: str) -> bool:
    try:
        return bcrypt.checkpw(clave.encode(), hash_guardado.encode())
    except ValueError:            # el hash no es bcrypt (p. ej. 'hash_demo')
        return False


def _vigentes(clave: str) -> deque:
    ahora = time.monotonic()
    q = _intentos[clave]
    while q and ahora - q[0] > 60:
        q.popleft()
    return q


def verificar_bloqueo(*claves: str) -> None:
    """Máximo 5 intentos FALLIDOS por minuto por correo (y 20 por IP)."""
    for clave in claves:
        tope = config.INTENTOS_LOGIN_POR_MINUTO * (4 if clave.startswith("ip:") else 1)
        if len(_vigentes(clave)) >= tope:
            raise HTTPException(429, "Demasiados intentos fallidos. Espere un minuto e intente de nuevo.")


def registrar_fallo(*claves: str) -> None:
    for clave in claves:
        _vigentes(clave).append(time.monotonic())


def crear_token(usuario: dict) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=config.JWT_MINUTOS)
    datos = {"sub": usuario["id_usuario"], "rol": usuario["id_rol"], "exp": exp}
    return jwt.encode(datos, _SECRETO, algorithm="HS256")


def usuario_actual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer), cn=Depends(get_db)) -> dict:
    if cred is None:
        raise HTTPException(401, "Debe iniciar sesión.", headers={"WWW-Authenticate": "Bearer"})
    try:
        datos = jwt.decode(cred.credentials, _SECRETO, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "La sesión expiró. Inicie sesión de nuevo.")
    except jwt.PyJWTError:
        raise HTTPException(401, "Token inválido.")
    u = uno(cn, """SELECT u.id_usuario, u.id_rol, r.nombre_rol, u.nombres, u.apellidos,
                          u.correo_institucional, u.id_organizacion, u.activo
                   FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ?""", datos["sub"])
    if not u or not u["activo"]:
        raise HTTPException(401, "El usuario no existe o está inactivo.")
    return u


def requiere(*roles: str):
    """Dependencia: deja pasar solo a los roles indicados (ADM siempre puede)."""
    def _dep(u: dict = Depends(usuario_actual)) -> dict:
        if u["id_rol"] != "ADM" and u["id_rol"] not in roles:
            raise HTTPException(403, "Su rol no tiene permiso para esta acción.")
        return u
    return _dep
