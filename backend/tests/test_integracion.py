"""Pruebas de integración: API + SQL Server real (Parte 4 del segundo avance).

Requisitos: la base EcoRaEE_CLOUD creada con 01_esquema, 02_datos y 05_usuarios_demo,
y el archivo backend/.env configurado. Ejecutar desde backend/:
    python -m pytest -v
Las pruebas crean sus propios datos (solicitud, equipos, centro), así que se
pueden repetir sin recrear la base.
"""
import io
import struct
import uuid
import zlib

import pytest
from fastapi.testclient import TestClient

from app.main import app

CLAVE = "EcoRaee2026!"
c = TestClient(app)
_tokens: dict[str, str] = {}


def h(correo: str) -> dict:
    if correo not in _tokens:
        r = c.post("/api/auth/login", json={"correo": correo, "password": CLAVE})
        assert r.status_code == 200, r.text
        _tokens[correo] = r.json()["token"]
    return {"Authorization": f"Bearer {_tokens[correo]}"}


ADM, GEN, OPE, TEC, COO, REA = ("admin@ecoraee.test", "gen1@ecoraee.test", "ope1@ecoraee.test",
                                 "tec1@ecoraee.test", "coo1@ecoraee.test", "rec1@ecoraee.test")


def png_unico() -> bytes:
    """PNG válido de 1x1 con un texto único (cada evidencia tiene hash distinto)."""
    def chunk(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    txt = b"Comment\x00" + uuid.uuid4().hex.encode()
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"tEXt", txt)
            + chunk(b"IDAT", zlib.compress(b"\x00\x00\x00\x00")) + chunk(b"IEND", b""))


def subir_evidencia(correo, **origen):
    return c.post("/api/evidencias", headers=h(correo),
                  data={"tipo_documento": "Foto de prueba", **origen},
                  files={"archivo": ("foto.png", io.BytesIO(png_unico()), "image/png")})


# ------------------------------------------------------------------ 1. conexión
def test_health_frontend_backend_bd():
    r = c.get("/api/health")
    assert r.status_code == 200
    assert r.json()["base"] == "EcoRaEE_CLOUD"
    assert c.get("/").status_code == 200            # el frontend se sirve


# ------------------------------------------------------------------ 2. login y roles (CP-01)
def test_login_incorrecto():
    r = c.post("/api/auth/login", json={"correo": "gen2@ecoraee.test", "password": "otra-clave"})
    assert r.status_code == 401
    assert "incorrectos" in r.json()["detalle"]


def test_login_usuario_inactivo():
    r = c.post("/api/auth/login", json={"correo": "tec2@ecoraee.test", "password": CLAVE})
    assert r.status_code == 401


def test_sin_token():
    assert c.get("/api/dispositivos").status_code == 401


def test_acceso_por_rol():
    assert c.get("/api/auditoria", headers=h(GEN)).status_code == 403
    assert c.post("/api/movimientos", headers=h(TEC), json={"id_dispositivo": "DSP-003",
                  "id_centro_destino": "C-LAB", "ubicacion": "x"}).status_code == 403
    assert c.get("/api/auditoria", headers=h(ADM)).status_code == 200
    # El generador solo ve sus propios equipos
    mios = c.get("/api/dispositivos", headers=h(GEN)).json()
    assert mios and all(d["id_usuario_generador"] == "U-GEN1" for d in mios)


# ------------------------------------------------------------------ 3. CRUD de catálogos
def test_crud_marca():
    r = c.post("/api/catalogos/marcas", headers=h(ADM), json={"nombre_marca": f"Marca {uuid.uuid4().hex[:6]}"})
    assert r.status_code == 201
    id_marca = r.json()["id_marca"]
    r = c.put(f"/api/catalogos/marcas/{id_marca}", headers=h(ADM), json={"nombre_marca": f"Editada {uuid.uuid4().hex[:6]}"})
    assert r.status_code == 200 and r.json()["nombre_marca"].startswith("Editada")
    assert c.delete(f"/api/catalogos/marcas/{id_marca}", headers=h(ADM)).status_code == 204
    # Una marca usada por dispositivos no se puede borrar (integridad referencial, CP-04)
    r = c.delete("/api/catalogos/marcas/M-DEL", headers=h(ADM))
    assert r.status_code == 409


def test_validaciones():
    r = c.post("/api/solicitudes", headers=h(GEN), json={"id_centro_destino": "C-NOR",
               "dispositivos": [{"id_categoria": "CAT-LAP", "id_marca": "M-HP", "peso_kg": -2}]})
    assert r.status_code == 422
    assert r.json()["campos"][0]["campo"].endswith("peso_kg")
    r = c.post("/api/solicitudes", headers=h(GEN), json={"id_centro_destino": "C-NO-EXISTE"})
    assert r.status_code == 400                       # FK inválida


# ------------------------------------------------------------------ 4. ciclo completo (CP-14)
def test_ciclo_completo_de_trazabilidad():
    serie = "SN-T" + uuid.uuid4().hex[:8].upper()
    # Generador registra la solicitud con 2 equipos (create)
    r = c.post("/api/solicitudes", headers=h(GEN), json={"id_centro_destino": "C-NOR", "dispositivos": [
        {"id_categoria": "CAT-IMP", "id_marca": "M-EPS", "numero_serie": serie, "modelo": "L3150", "peso_kg": 6.1},
        {"id_categoria": "CAT-CEL", "id_marca": "M-SAM", "modelo": "A10", "peso_kg": 0.2}]})
    assert r.status_code == 201, r.text
    sol = r.json()
    assert sol["estado_solicitud"] == "Pendiente" and sol["n_dispositivos"] == 2
    d1, d2 = (d["id_dispositivo"] for d in sol["dispositivos"])

    # CP-02: no se repite el número de serie
    r = c.post(f"/api/solicitudes/{sol['id_solicitud']}/dispositivos", headers=h(GEN),
               json={"id_categoria": "CAT-IMP", "id_marca": "M-EPS", "numero_serie": serie, "peso_kg": 5})
    assert r.status_code == 409

    # update: corrige el peso mientras está Registrado
    r = c.put(f"/api/dispositivos/{d1}", headers=h(GEN), json={"id_categoria": "CAT-IMP", "id_marca": "M-EPS",
              "numero_serie": serie, "modelo": "L3150", "peso_kg": 6.3})
    assert r.status_code == 200 and float(r.json()["peso_kg"]) == 6.3

    # CP-03: no se puede evaluar un equipo que no fue recolectado
    r = c.post("/api/evaluaciones", headers=h(TEC), json={"id_dispositivo": d1, "id_condicion": "CON-FMA",
               "id_clasificacion": "CL-REC", "diagnostico": "Placa dañada, se recicla"})
    assert r.status_code == 409

    # Operador programa la recolección y recibe la solicitud (sp_recibir_solicitud)
    r = c.put(f"/api/solicitudes/{sol['id_solicitud']}/recoleccion", headers=h(OPE),
              json={"id_usuario_operador": "U-OPE1", "fecha_programada": "2030-01-15T09:00:00"})
    assert r.status_code == 200
    r = c.post(f"/api/solicitudes/{sol['id_solicitud']}/recibir", headers=h(OPE), json={"ubicacion": "Estante T"})
    assert r.status_code == 200, r.text
    assert r.json()["estado_solicitud"] == "Recibida"
    assert all(d["estado_actual"] == "Recolectado" for d in r.json()["dispositivos"])

    # Técnico evalúa (RN-02)
    for disp, cl, co in ((d1, "CL-REC", "CON-FMA"), (d2, "CL-NRE", "CON-DES")):
        r = c.post("/api/evaluaciones", headers=h(TEC), json={"id_dispositivo": disp, "id_condicion": co,
                   "id_clasificacion": cl, "diagnostico": "Diagnóstico de prueba automatizada"})
        assert r.status_code == 201, r.text

    # RN-04: un equipo No recuperable no puede ir a un beneficiario
    r = c.post("/api/transferencias", headers=h(COO), json={"id_dispositivo": d2, "id_destino": "D-FUN"})
    assert r.status_code == 409 and "RN-04" in r.json()["detalle"]

    # Movimiento al laboratorio; RN-03: no se cierra sin evidencia
    r = c.post("/api/movimientos", headers=h(COO), json={"id_dispositivo": d1, "id_centro_destino": "C-LAB", "ubicacion": "Mesa T"})
    assert r.status_code == 201, r.text
    mov = r.json()["id_movimiento"]
    r = c.post(f"/api/movimientos/{mov}/cerrar", headers=h(COO))
    assert r.status_code == 409 and "RN-03" in r.json()["detalle"]
    assert subir_evidencia(COO, id_movimiento=mov).status_code == 201
    assert c.post(f"/api/movimientos/{mov}/cerrar", headers=h(COO)).json()["estado_movimiento"] == "Cerrado"

    # Transferencia al gestor de reciclaje, tratamiento y confirmación (RN-08)
    r = c.post("/api/transferencias", headers=h(COO), json={"id_dispositivo": d1, "id_destino": "D-REC"})
    assert r.status_code == 201, r.text
    tr = r.json()["id_transferencia"]
    r = c.post("/api/tratamientos", headers=h(REA), json={"id_transferencia": tr, "tipo_tratamiento": "Reciclaje",
               "resultado": "Separación de plásticos y metales"})
    assert r.status_code == 201, r.text
    r = c.post(f"/api/transferencias/{tr}/confirmar", headers=h(REA))
    assert r.status_code == 409 and "RN-08" in r.json()["detalle"]
    assert subir_evidencia(REA, id_transferencia=tr).status_code == 201
    assert c.post(f"/api/transferencias/{tr}/confirmar", headers=h(REA)).json()["estado_cierre"] == "Cerrado"

    # Cierre de la trazabilidad y consulta de la línea de vida
    r = c.post(f"/api/dispositivos/{d1}/cerrar", headers=h(COO))
    assert r.status_code == 200 and r.json()["estado_actual"] == "Cerrado"
    det = c.get(f"/api/dispositivos/{d1}", headers=h(COO)).json()
    assert [x["estado_nuevo"] for x in det["historial"]] == ["Registrado", "Recolectado", "Evaluado", "Reciclaje", "Valorizado", "Cerrado"]
    assert len(det["evidencias"]) == 2

    # Generador consulta su equipo por QR
    assert c.get(f"/api/dispositivos/{det['codigo_qr']}", headers=h(GEN)).json()["estado_actual"] == "Cerrado"


# ------------------------------------------------------------------ 5. rollback por capacidad (CP-05)
def test_rollback_centro_lleno():
    r = c.post("/api/centros", headers=h(ADM), json={"id_tipo_centro": "TC-BOD", "nombre_centro": f"Bodega {uuid.uuid4().hex[:5]}",
               "capacidad_unidades": 1, "capacidad_volumetrica_m3": 1})
    assert r.status_code == 201
    centro = r.json()["id_centro"]
    evaluados = [d for d in c.get("/api/dispositivos?estado=Evaluado", headers=h(COO)).json() if d["id_centro_actual"]]
    a, b = evaluados[0], evaluados[1]
    assert c.post("/api/movimientos", headers=h(COO), json={"id_dispositivo": a["id_dispositivo"],
                  "id_centro_destino": centro, "ubicacion": "B1"}).status_code == 201
    r = c.post("/api/movimientos", headers=h(COO), json={"id_dispositivo": b["id_dispositivo"],
               "id_centro_destino": centro, "ubicacion": "B2"})
    assert r.status_code == 409 and "RN-06" in r.json()["detalle"]
    # Nada cambió para el segundo equipo
    assert c.get(f"/api/dispositivos/{b['id_dispositivo']}", headers=h(COO)).json()["id_centro_actual"] == b["id_centro_actual"]
    assert c.get(f"/api/centros/{centro}", headers=h(COO)).json()["ocupacion_actual_unidades"] == 1


# ------------------------------------------------------------------ 6. flujo máximo con datos de la BD (CP-07, CP-09)
def test_flujo_maximo_desde_bd():
    r = c.post("/api/red/escenarios/ESC-1/ejecutar", headers=h(COO))
    assert r.status_code == 200, r.text
    res = r.json()
    assert float(res["resultado"]["flujo_maximo_kg"]) == 140
    assert float(res["capacidad_corte"]) == 140                       # flujo máximo = corte mínimo
    corte = {(a["nombre_origen"], a["nombre_destino"]) for a in res["resultado"]["aristas"] if a["en_corte_minimo"]}
    assert ("Laboratorio de Evaluación", "Disposición final") in corte
    esperado = {"ESC-2": 145, "ESC-3": 140, "ESC-4": 145, "ESC-5": 180}
    for esc, valor in esperado.items():
        assert float(c.post(f"/api/red/escenarios/{esc}/ejecutar", headers=h(COO)).json()["resultado"]["flujo_maximo_kg"]) == valor


def test_crud_escenario():
    r = c.post("/api/red/escenarios", headers=h(COO), json={"nombre_escenario": "Prueba API", "aristas": [
        {"id_nodo_origen": "N-S", "id_nodo_destino": "N-NOR", "capacidad_kg": 50},
        {"id_nodo_origen": "N-NOR", "id_nodo_destino": "N-REC", "capacidad_kg": 30},
        {"id_nodo_origen": "N-REC", "id_nodo_destino": "N-T", "capacidad_kg": 90}]})
    assert r.status_code == 201, r.text
    esc = r.json()["id_escenario"]
    assert float(c.post(f"/api/red/escenarios/{esc}/ejecutar", headers=h(COO)).json()["resultado"]["flujo_maximo_kg"]) == 30
    assert c.delete(f"/api/red/escenarios/{esc}", headers=h(COO)).status_code == 204


# ------------------------------------------------------------------ 7. usuarios (eliminación lógica)
def test_crud_usuario():
    correo = f"nuevo.{uuid.uuid4().hex[:6]}@ecoraee.test"
    r = c.post("/api/usuarios", headers=h(ADM), json={"id_organizacion": "ORG-CS", "id_rol": "OPE", "nombres": "Ana",
               "apellidos": "Prueba", "correo_institucional": correo, "password": "ClaveSegura1"})
    assert r.status_code == 201, r.text
    uid = r.json()["id_usuario"]
    assert c.post("/api/auth/login", json={"correo": correo, "password": "ClaveSegura1"}).status_code == 200
    assert c.delete(f"/api/usuarios/{uid}", headers=h(ADM)).json()["activo"] is False
    assert c.post("/api/auth/login", json={"correo": correo, "password": "ClaveSegura1"}).status_code == 401
