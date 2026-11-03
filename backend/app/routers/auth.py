from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..db import ejecutar, get_db, uno
from ..seguridad import crear_token, registrar_fallo, usuario_actual, verificar_bloqueo, verificar_password

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


class Login(BaseModel):
    correo: str = Field(min_length=5, max_length=150, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=100)


@router.post("/login")
def login(datos: Login, request: Request, cn=Depends(get_db)):
    correo = datos.correo.strip().lower()
    claves = (correo, "ip:" + (request.client.host if request.client else "?"))
    verificar_bloqueo(*claves)
    u = uno(cn, """SELECT u.id_usuario, u.id_rol, r.nombre_rol, u.nombres, u.apellidos,
                          u.correo_institucional, u.hash_password, u.activo
                   FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
                   WHERE LOWER(u.correo_institucional) = ?""", correo)
    if not u or not u["activo"] or not verificar_password(datos.password, u["hash_password"]):
        # Mismo mensaje en todos los casos: no revela si el correo existe.
        registrar_fallo(*claves)
        ejecutar(cn, "INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario) VALUES (?, ?, ?, ?)",
                 "usuario", "LOGIN_FALLIDO", f"Intento fallido para {correo[:120]}", u["id_usuario"] if u else None)
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    ejecutar(cn, "INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario) VALUES (?, ?, ?, ?)",
             "usuario", "LOGIN", "Inicio de sesión", u["id_usuario"])
    u.pop("hash_password")
    return {"token": crear_token(u), "usuario": u}


@router.get("/me")
def me(u: dict = Depends(usuario_actual)):
    return u
