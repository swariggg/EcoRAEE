"""CRUD de catálogos simples (categorías, marcas, condiciones, tipos de centro,
organizaciones) y consulta de los catálogos fijos (roles, clasificaciones,
tipos de destino y la relación de compatibilidad)."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, create_model

from ..db import ejecutar, get_db, siguiente_id, todos, uno
from ..seguridad import requiere, usuario_actual

router = APIRouter(prefix="/api/catalogos", tags=["Catálogos"])

TEXTO = lambda n, req=True: (str if req else Optional[str], Field(... if req else None, min_length=1 if req else 0, max_length=n))

CATALOGOS = {
    "categorias": dict(tabla="categoria", pk="id_categoria", prefijo="CAT-", orden="nombre_categoria",
                       campos={"nombre_categoria": TEXTO(50)}),
    "marcas": dict(tabla="marca", pk="id_marca", prefijo="M-", orden="nombre_marca",
                   campos={"nombre_marca": TEXTO(50)}),
    "condiciones": dict(tabla="condicion", pk="id_condicion", prefijo="CON-", orden="nombre_condicion",
                        campos={"nombre_condicion": TEXTO(50), "descripcion": TEXTO(200, False)}),
    "tipos-centro": dict(tabla="tipo_centro", pk="id_tipo_centro", prefijo="TC-", orden="nombre_tipo",
                         campos={"nombre_tipo": TEXTO(50)}),
    "organizaciones": dict(tabla="organizacion", pk="id_organizacion", prefijo="ORG-", orden="nombre",
                           campos={"nombre": TEXTO(100),
                                   "tipo_organizacion": (Literal["Interna", "Externa"], ...),
                                   "ubicacion": TEXTO(150, False)}),
}
SOLO_LECTURA = {
    "roles": "SELECT id_rol, nombre_rol FROM rol ORDER BY id_rol",
    "clasificaciones": "SELECT id_clasificacion, nombre_clasificacion FROM clasificacion ORDER BY id_clasificacion",
    "tipos-destino": "SELECT id_tipo_destino, nombre_tipo, estado_resultante FROM tipo_destino ORDER BY id_tipo_destino",
    "compatibilidad": """SELECT cd.id_clasificacion, c.nombre_clasificacion, cd.id_tipo_destino, td.nombre_tipo
                         FROM compatibilidad_destino cd
                         JOIN clasificacion c ON c.id_clasificacion = cd.id_clasificacion
                         JOIN tipo_destino td ON td.id_tipo_destino = cd.id_tipo_destino
                         ORDER BY cd.id_clasificacion""",
}
MODELOS = {k: create_model(f"Catalogo_{k.replace('-', '_')}", **v["campos"]) for k, v in CATALOGOS.items()}


def _conf(nombre: str) -> dict:
    if nombre not in CATALOGOS:
        raise HTTPException(404, "Catálogo no encontrado.")
    return CATALOGOS[nombre]


def _limpio(d: BaseModel) -> dict:
    return {k: (v.strip() if isinstance(v, str) else v) or None for k, v in d.model_dump().items()}


@router.get("")
def indice(_: dict = Depends(usuario_actual)):
    return {"editables": list(CATALOGOS), "fijos": list(SOLO_LECTURA)}


@router.get("/{nombre}")
def listar(nombre: str, cn=Depends(get_db), _: dict = Depends(usuario_actual)):
    if nombre in SOLO_LECTURA:
        return todos(cn, SOLO_LECTURA[nombre])
    c = _conf(nombre)
    return todos(cn, f"SELECT * FROM {c['tabla']} ORDER BY {c['orden']}")


def _crear(nombre: str):
    c, Modelo = CATALOGOS[nombre], MODELOS[nombre]

    def crear(datos: Modelo, cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):  # type: ignore[valid-type]
        valores = _limpio(datos)
        nuevo = siguiente_id(cn, c["tabla"], c["pk"], c["prefijo"])
        cols = [c["pk"], *valores]
        ejecutar(cn, f"INSERT INTO {c['tabla']} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                 nuevo, *valores.values())
        return uno(cn, f"SELECT * FROM {c['tabla']} WHERE {c['pk']} = ?", nuevo)

    def actualizar(id: str, datos: Modelo, cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):  # type: ignore[valid-type]
        valores = _limpio(datos)
        sets = ", ".join(f"{k} = ?" for k in valores)
        if ejecutar(cn, f"UPDATE {c['tabla']} SET {sets} WHERE {c['pk']} = ?", *valores.values(), id) == 0:
            raise HTTPException(404, "Registro no encontrado.")
        return uno(cn, f"SELECT * FROM {c['tabla']} WHERE {c['pk']} = ?", id)

    return crear, actualizar


for _n in CATALOGOS:
    _c, _a = _crear(_n)
    router.add_api_route(f"/{_n}", _c, methods=["POST"], status_code=201, summary=f"Crear en {_n}")
    router.add_api_route(f"/{_n}/{{id}}", _a, methods=["PUT"], summary=f"Actualizar en {_n}")


@router.delete("/{nombre}/{id}", status_code=204)
def eliminar(nombre: str, id: str, cn=Depends(get_db), _: dict = Depends(requiere("ADM"))):
    c = _conf(nombre)
    # Si otro registro lo usa, SQL Server rechaza el DELETE (FK) y se responde 409.
    if ejecutar(cn, f"DELETE FROM {c['tabla']} WHERE {c['pk']} = ?", id) == 0:
        raise HTTPException(404, "Registro no encontrado.")
