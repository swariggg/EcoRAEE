"""Red logística y flujo máximo (Matemática Discreta integrada a la API).
El algoritmo lee la red DESDE LA BASE (vw_red) y guarda el resultado en la base (RF-INT-04, CP-09)."""
import json
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import ejecutar, get_db, siguiente_id, todos, transaccion, uno
from ..flujo import edmonds_karp
from ..seguridad import PERSONAL, requiere

router = APIRouter(prefix="/api/red", tags=["Red y flujo máximo"])


class Arista(BaseModel):
    id_nodo_origen: str = Field(min_length=1, max_length=20)
    id_nodo_destino: str = Field(min_length=1, max_length=20)
    capacidad_kg: Decimal = Field(gt=0, le=100000, max_digits=10, decimal_places=2)


class Escenario(BaseModel):
    nombre_escenario: str = Field(min_length=3, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=300)
    periodo: str = Field("semana", min_length=3, max_length=30)
    id_nodo_fuente: str = Field("N-S", max_length=20)
    id_nodo_sumidero: str = Field("N-T", max_length=20)
    aristas: list[Arista] = Field(min_length=1, max_length=200)
    copiar_de: Optional[str] = None


@router.get("/nodos")
def nodos(cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    return todos(cn, "SELECT * FROM nodo ORDER BY CASE tipo_nodo WHEN 'FUENTE' THEN 0 WHEN 'CENTRO' THEN 1 WHEN 'DESTINO' THEN 2 ELSE 3 END, id_nodo")


@router.get("/oferta")
def oferta(cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    """Kg evaluados que esperan destino en cada centro (dato real para las aristas fuente -> centro)."""
    return todos(cn, "SELECT * FROM vw_oferta_kg_centro ORDER BY id_nodo")


@router.get("/escenarios")
def listar(cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    return todos(cn, """SELECT e.*, (SELECT COUNT(*) FROM arista a WHERE a.id_escenario = e.id_escenario) AS n_aristas,
                               ult.nro_ejecucion AS ultima_ejecucion, ult.flujo_maximo_kg, ult.fecha_ejecucion
                        FROM escenario e
                        OUTER APPLY (SELECT TOP 1 r.nro_ejecucion, r.flujo_maximo_kg, r.fecha_ejecucion FROM resultado r
                                     WHERE r.id_escenario = e.id_escenario ORDER BY r.nro_ejecucion DESC) ult
                        ORDER BY e.id_escenario""")


def _detalle(cn, id: str) -> dict:
    e = uno(cn, "SELECT * FROM escenario WHERE id_escenario = ?", id)
    if not e:
        raise HTTPException(404, "Escenario no encontrado.")
    e["aristas"] = todos(cn, "SELECT * FROM vw_red WHERE id_escenario = ? ORDER BY nro_arista", id)
    e["ejecuciones"] = todos(cn, "SELECT nro_ejecucion, algoritmo, flujo_maximo_kg, fecha_ejecucion FROM resultado WHERE id_escenario = ? ORDER BY nro_ejecucion DESC", id)
    e["resultado"] = None
    if e["ejecuciones"]:
        nro = e["ejecuciones"][0]["nro_ejecucion"]
        e["resultado"] = {"nro_ejecucion": nro, "flujo_maximo_kg": e["ejecuciones"][0]["flujo_maximo_kg"],
                          "aristas": todos(cn, """SELECT * FROM vw_resultado_flujo WHERE id_escenario = ? AND nro_ejecucion = ?
                                                  ORDER BY nro_arista""", id, nro)}
    return e


@router.get("/escenarios/{id}")
def ver(id: str, cn=Depends(get_db), _: dict = Depends(requiere(*PERSONAL))):
    return _detalle(cn, id)


def _guardar_aristas(cn, id: str, aristas: list[Arista]):
    vistos = set()
    for i, a in enumerate(aristas, start=1):
        par = (a.id_nodo_origen, a.id_nodo_destino)
        if par in vistos:
            raise HTTPException(422, f"La arista {par[0]} -> {par[1]} está repetida.")
        vistos.add(par)
        ejecutar(cn, "INSERT INTO arista (id_escenario, nro_arista, id_nodo_origen, id_nodo_destino, capacidad_kg) VALUES (?, ?, ?, ?, ?)",
                 id, i, a.id_nodo_origen, a.id_nodo_destino, a.capacidad_kg)


@router.post("/escenarios", status_code=201)
def crear(d: Escenario, cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    with transaccion(cn):
        nuevo = siguiente_id(cn, "escenario", "id_escenario", "ESC-", 1)
        ejecutar(cn, """INSERT INTO escenario (id_escenario, nombre_escenario, descripcion, periodo, id_nodo_fuente, id_nodo_sumidero)
                        VALUES (?, ?, ?, ?, ?, ?)""", nuevo, d.nombre_escenario.strip(), (d.descripcion or "").strip() or None,
                 d.periodo.strip(), d.id_nodo_fuente, d.id_nodo_sumidero)
        _guardar_aristas(cn, nuevo, d.aristas)
    return _detalle(cn, nuevo)


@router.put("/escenarios/{id}")
def actualizar(id: str, d: Escenario, cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    """Cambia datos y aristas. Si el escenario ya tiene ejecuciones guardadas, solo se
    permiten cambiar capacidades (las aristas existentes están referenciadas por los resultados)."""
    _detalle(cn, id)
    with transaccion(cn):
        ejecutar(cn, """UPDATE escenario SET nombre_escenario = ?, descripcion = ?, periodo = ?,
                        id_nodo_fuente = ?, id_nodo_sumidero = ? WHERE id_escenario = ?""",
                 d.nombre_escenario.strip(), (d.descripcion or "").strip() or None, d.periodo.strip(),
                 d.id_nodo_fuente, d.id_nodo_sumidero, id)
        tiene_resultados = uno(cn, "SELECT 1 AS x FROM resultado WHERE id_escenario = ?", id)
        if not tiene_resultados:
            ejecutar(cn, "DELETE FROM arista WHERE id_escenario = ?", id)
            _guardar_aristas(cn, id, d.aristas)
        else:
            actuales = {(a["id_nodo_origen"], a["id_nodo_destino"]): a["nro_arista"]
                        for a in todos(cn, "SELECT * FROM arista WHERE id_escenario = ?", id)}
            nuevas = {(a.id_nodo_origen, a.id_nodo_destino): a for a in d.aristas}
            if set(actuales) - set(nuevas):
                raise HTTPException(409, "El escenario ya tiene ejecuciones: no se pueden quitar aristas, solo cambiar capacidades o agregar nuevas.")
            siguiente = max(actuales.values(), default=0)
            for par, a in nuevas.items():
                if par in actuales:
                    ejecutar(cn, "UPDATE arista SET capacidad_kg = ? WHERE id_escenario = ? AND nro_arista = ?",
                             a.capacidad_kg, id, actuales[par])
                else:
                    siguiente += 1
                    ejecutar(cn, "INSERT INTO arista (id_escenario, nro_arista, id_nodo_origen, id_nodo_destino, capacidad_kg) VALUES (?, ?, ?, ?, ?)",
                             id, siguiente, par[0], par[1], a.capacidad_kg)
    return _detalle(cn, id)


@router.delete("/escenarios/{id}", status_code=204)
def eliminar(id: str, cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    _detalle(cn, id)
    with transaccion(cn):        # se borra el escenario con sus entidades débiles
        ejecutar(cn, "DELETE FROM resultado_arista WHERE id_escenario = ?", id)
        ejecutar(cn, "DELETE FROM resultado WHERE id_escenario = ?", id)
        ejecutar(cn, "DELETE FROM arista WHERE id_escenario = ?", id)
        ejecutar(cn, "DELETE FROM escenario WHERE id_escenario = ?", id)


@router.post("/escenarios/{id}/ejecutar")
def ejecutar_flujo(id: str, cn=Depends(get_db), _: dict = Depends(requiere("COO"))):
    red = todos(cn, "SELECT * FROM vw_red WHERE id_escenario = ? ORDER BY nro_arista", id)
    if not red:
        raise HTTPException(404, "El escenario no existe o no tiene aristas.")
    s, t = red[0]["id_nodo_fuente"], red[0]["id_nodo_sumidero"]
    total, flujo, corte, caminos = edmonds_karp(
        [(a["id_nodo_origen"], a["id_nodo_destino"], a["capacidad_kg"]) for a in red], s, t)
    por_arista = [{"nro_arista": a["nro_arista"],
                   "flujo_kg": float(flujo[(a["id_nodo_origen"], a["id_nodo_destino"])]),
                   "en_corte_minimo": 1 if (a["id_nodo_origen"], a["id_nodo_destino"]) in corte else 0} for a in red]
    ejecutar(cn, "EXEC sp_guardar_resultado_flujo ?, ?, ?", id, total, json.dumps(por_arista))
    det = _detalle(cn, id)
    nombres = {a["id_nodo_origen"]: a["nombre_origen"] for a in red} | {a["id_nodo_destino"]: a["nombre_destino"] for a in red}
    det["caminos"] = [{"nodos": [nombres.get(n, n) for n in c["nodos"]], "aumento": c["aumento"]} for c in caminos]
    det["capacidad_corte"] = sum(a["capacidad_kg"] for a in red if (a["id_nodo_origen"], a["id_nodo_destino"]) in corte)
    return det
