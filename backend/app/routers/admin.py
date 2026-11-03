"""Centros, destinos y usuarios."""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import ejecutar, get_db, siguiente_id, todos, transaccion, uno
from ..seguridad import ROLES, hash_password, requiere, usuario_actual

router = APIRouter(prefix="/api", tags=["Centros, destinos y usuarios"])


# ------------------------------------------------------------------ centros
class Centro(BaseModel):
    id_tipo_centro: str = Field(min_length=1, max_length=20)
    nombre_centro: str = Field(min_length=3, max_length=100)
    capacidad_unidades: int = Field(gt=0, le=100000)
    capacidad_volumetrica_m3: Decimal = Field(gt=0, le=100000, max_digits=10, decimal_places=2)


SQL_CENTROS = """SELECT c.*, tc.nombre_tipo,
       CAST(100.0 * c.ocupacion_actual_unidades / c.capacidad_unidades AS DECIMAL(5,1)) AS ocupacion_pct,
       (SELECT ISNULL(SUM(d.peso_kg), 0) FROM dispositivo d WHERE d.id_centro_actual = c.id_centro) AS kg_en_centro
FROM centro c JOIN tipo_centro tc ON tc.id_tipo_centro = c.id_tipo_centro"""


@router.get("/centros")
def listar_centros(cn=Depends(get_db), _: dict = Depends(usuario_actual)):
    return todos(cn, SQL_CENTROS + " ORDER BY c.nombre_centro")


@router.get("/centros/{id}")
def ver_centro(id: str, cn=Depends(get_db), _: dict = Depends(usuario_actual)):
    c = uno(cn, SQL_CENTROS + " WHERE c.id_centro = ?", id)
    if not c:
        raise HTTPException(404, "Centro no encontrado.")
    c["inventario"] = todos(cn, """SELECT d.id_dispositivo, cat.nombre_categoria, d.peso_kg, d.ubicacion_centro,
                                         d.estado_actual, d.fecha_ingreso_centro
                                  FROM dispositivo d JOIN categoria cat ON cat.id_categoria = d.id_categoria
                                  WHERE d.id_centro_actual = ? ORDER BY d.id_dispositivo""", id)
    return c


@router.post("/centros", status_code=201)
def crear_centro(d: Centro, cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):
    nuevo = siguiente_id(cn, "centro", "id_centro", "C-")
    ejecutar(cn, """INSERT INTO centro (id_centro, id_tipo_centro, nombre_centro, capacidad_unidades, capacidad_volumetrica_m3)
                    VALUES (?, ?, ?, ?, ?)""", nuevo, d.id_tipo_centro, d.nombre_centro.strip(),
             d.capacidad_unidades, d.capacidad_volumetrica_m3)
    return uno(cn, SQL_CENTROS + " WHERE c.id_centro = ?", nuevo)


@router.put("/centros/{id}")
def actualizar_centro(id: str, d: Centro, cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):
    # Si la nueva capacidad es menor que la ocupación, el CHECK ck_centro_capacidad lo rechaza.
    n = ejecutar(cn, """UPDATE centro SET id_tipo_centro = ?, nombre_centro = ?, capacidad_unidades = ?,
                        capacidad_volumetrica_m3 = ? WHERE id_centro = ?""",
                 d.id_tipo_centro, d.nombre_centro.strip(), d.capacidad_unidades, d.capacidad_volumetrica_m3, id)
    if n == 0:
        raise HTTPException(404, "Centro no encontrado.")
    return uno(cn, SQL_CENTROS + " WHERE c.id_centro = ?", id)


@router.delete("/centros/{id}", status_code=204)
def eliminar_centro(id: str, cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):
    if ejecutar(cn, "DELETE FROM centro WHERE id_centro = ?", id) == 0:
        raise HTTPException(404, "Centro no encontrado.")


# ------------------------------------------------------------------ destinos
class Destino(BaseModel):
    id_tipo_destino: str = Field(min_length=1, max_length=20)
    id_organizacion: Optional[str] = Field(None, max_length=20)
    nombre_entidad: str = Field(min_length=3, max_length=150)
    ruc_identificacion: str = Field(pattern=r"^\d{10}(\d{3})?$", description="Cédula (10) o RUC (13 dígitos)")
    certificacion_ambiental: Optional[str] = Field(None, max_length=100)


SQL_DESTINOS = """SELECT de.*, td.nombre_tipo, td.estado_resultante, o.nombre AS organizacion
FROM destino de JOIN tipo_destino td ON td.id_tipo_destino = de.id_tipo_destino
LEFT JOIN organizacion o ON o.id_organizacion = de.id_organizacion"""


@router.get("/destinos")
def listar_destinos(cn=Depends(get_db), _: dict = Depends(usuario_actual)):
    return todos(cn, SQL_DESTINOS + " ORDER BY de.nombre_entidad")


@router.post("/destinos", status_code=201)
def crear_destino(d: Destino, cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    nuevo = siguiente_id(cn, "destino", "id_destino", "D-")
    ejecutar(cn, """INSERT INTO destino (id_destino, id_tipo_destino, id_organizacion, nombre_entidad,
                    ruc_identificacion, certificacion_ambiental) VALUES (?, ?, ?, ?, ?, ?)""",
             nuevo, d.id_tipo_destino, d.id_organizacion or None, d.nombre_entidad.strip(),
             d.ruc_identificacion, (d.certificacion_ambiental or "").strip() or None)
    return uno(cn, SQL_DESTINOS + " WHERE de.id_destino = ?", nuevo)


@router.put("/destinos/{id}")
def actualizar_destino(id: str, d: Destino, cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    n = ejecutar(cn, """UPDATE destino SET id_tipo_destino = ?, id_organizacion = ?, nombre_entidad = ?,
                        ruc_identificacion = ?, certificacion_ambiental = ? WHERE id_destino = ?""",
                 d.id_tipo_destino, d.id_organizacion or None, d.nombre_entidad.strip(), d.ruc_identificacion,
                 (d.certificacion_ambiental or "").strip() or None, id)
    if n == 0:
        raise HTTPException(404, "Destino no encontrado.")
    return uno(cn, SQL_DESTINOS + " WHERE de.id_destino = ?", id)


@router.delete("/destinos/{id}", status_code=204)
def eliminar_destino(id: str, cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    if ejecutar(cn, "DELETE FROM destino WHERE id_destino = ?", id) == 0:
        raise HTTPException(404, "Destino no encontrado.")


# ------------------------------------------------------------------ usuarios
class UsuarioBase(BaseModel):
    id_organizacion: str = Field(min_length=1, max_length=20)
    id_rol: str = Field(min_length=3, max_length=3)
    nombres: str = Field(min_length=2, max_length=100)
    apellidos: str = Field(min_length=2, max_length=100)
    correo_institucional: str = Field(max_length=150, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UsuarioNuevo(UsuarioBase):
    password: str = Field(min_length=8, max_length=100)


class UsuarioEditar(UsuarioBase):
    activo: bool = True
    password: Optional[str] = Field(None, min_length=8, max_length=100)


SQL_USUARIOS = """SELECT u.id_usuario, u.id_organizacion, o.nombre AS organizacion, u.id_rol, r.nombre_rol,
       u.nombres, u.apellidos, u.correo_institucional, u.activo
FROM usuario u JOIN rol r ON r.id_rol = u.id_rol JOIN organizacion o ON o.id_organizacion = u.id_organizacion"""


def _validar_rol(rol: str):
    if rol not in ROLES:
        raise HTTPException(422, "Rol no válido.")


@router.get("/usuarios")
def listar_usuarios(rol: Optional[str] = None, cn=Depends(get_db), u: dict = Depends(usuario_actual)):
    # Los coordinadores y operadores necesitan ver técnicos/operadores para asignar tareas.
    if u["id_rol"] == "ADM":
        sql, p = SQL_USUARIOS, []
    else:
        sql, p = SQL_USUARIOS + " WHERE u.activo = 1", []
    if rol:
        sql += (" AND" if "WHERE" in sql else " WHERE") + " u.id_rol = ?"
        p.append(rol)
    return todos(cn, sql + " ORDER BY u.id_rol, u.apellidos", *p)


@router.post("/usuarios", status_code=201)
def crear_usuario(d: UsuarioNuevo, cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):
    _validar_rol(d.id_rol)
    nuevo = siguiente_id(cn, "usuario", "id_usuario", f"U-{d.id_rol}", 1)
    ejecutar(cn, """INSERT INTO usuario (id_usuario, id_organizacion, id_rol, nombres, apellidos,
                    correo_institucional, hash_password) VALUES (?, ?, ?, ?, ?, ?, ?)""",
             nuevo, d.id_organizacion, d.id_rol, d.nombres.strip(), d.apellidos.strip(),
             d.correo_institucional.strip().lower(), hash_password(d.password))
    return uno(cn, SQL_USUARIOS + " WHERE u.id_usuario = ?", nuevo)


@router.put("/usuarios/{id}")
def actualizar_usuario(id: str, d: UsuarioEditar, cn=Depends(get_db), yo: dict = Depends(requiere("ADM"))):
    _validar_rol(d.id_rol)
    if id == yo["id_usuario"] and (not d.activo or d.id_rol != "ADM"):
        raise HTTPException(409, "No puede quitarse a sí mismo el rol de administrador ni desactivarse.")
    with transaccion(cn):
        n = ejecutar(cn, """UPDATE usuario SET id_organizacion = ?, id_rol = ?, nombres = ?, apellidos = ?,
                            correo_institucional = ?, activo = ? WHERE id_usuario = ?""",
                     d.id_organizacion, d.id_rol, d.nombres.strip(), d.apellidos.strip(),
                     d.correo_institucional.strip().lower(), d.activo, id)
        if n == 0:
            raise HTTPException(404, "Usuario no encontrado.")
        if d.password:
            ejecutar(cn, "UPDATE usuario SET hash_password = ? WHERE id_usuario = ?", hash_password(d.password), id)
    return uno(cn, SQL_USUARIOS + " WHERE u.id_usuario = ?", id)


@router.delete("/usuarios/{id}")
def desactivar_usuario(id: str, cn=Depends(get_db), yo: dict = Depends(requiere("ADM"))):
    """Eliminación lógica: el usuario queda inactivo. Sus registros (historial,
    evaluaciones, auditoría) se conservan para la trazabilidad."""
    if id == yo["id_usuario"]:
        raise HTTPException(409, "No puede desactivarse a sí mismo.")
    if ejecutar(cn, "UPDATE usuario SET activo = 0 WHERE id_usuario = ?", id) == 0:
        raise HTTPException(404, "Usuario no encontrado.")
    ejecutar(cn, "INSERT INTO auditoria (tabla_afectada, operacion, detalle, id_usuario) VALUES ('usuario', 'DESACTIVAR', ?, ?)",
             f"Usuario {id} desactivado", yo["id_usuario"])
    return {"id_usuario": id, "activo": False}
