"""Evidencias (fotos y actas). En local se guardan en backend/uploads; en AWS
irán al bucket privado de S3. La base guarda la ruta y el hash SHA-256."""
import hashlib
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .. import config
from ..db import ejecutar, get_db, siguiente_id, todos, uno
from ..seguridad import PERSONAL, requiere

router = APIRouter(prefix="/api/evidencias", tags=["Evidencias"])

FIRMAS = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png", b"%PDF": "application/pdf"}

SQL_EVI = """SELECT ev.id_evidencia, ev.id_transferencia, ev.id_evaluacion, ev.id_movimiento, ev.tipo_documento,
       ev.nivel_acceso, ev.fecha_carga, ev.hash_sha256, ev.url_s3, ev.id_usuario_carga,
       u.nombres + ' ' + u.apellidos AS cargado_por,
       COALESCE(t.id_dispositivo, e.id_dispositivo, m.id_dispositivo) AS id_dispositivo
FROM evidencia ev JOIN usuario u ON u.id_usuario = ev.id_usuario_carga
LEFT JOIN transferencia t ON t.id_transferencia = ev.id_transferencia
LEFT JOIN evaluacion e ON e.id_evaluacion = ev.id_evaluacion
LEFT JOIN movimiento m ON m.id_movimiento = ev.id_movimiento"""


def _puede_ver(ev: dict, u: dict) -> bool:
    """RN-07: las evidencias restringidas solo las ven el coordinador, el administrador y quien las subió."""
    return ev["nivel_acceso"] == "Interno" or u["id_rol"] in ("ADM", "COO") or ev["id_usuario_carga"] == u["id_usuario"]


@router.get("")
def listar(cn=Depends(get_db), u: dict = Depends(requiere(*PERSONAL))):
    filas = todos(cn, SQL_EVI + " ORDER BY ev.fecha_carga DESC")
    return [dict(f, archivo_local=f["url_s3"].startswith("local://"), url_s3=None)
            for f in filas if _puede_ver(f, u)]


@router.post("", status_code=201)
async def subir(archivo: UploadFile = File(...),
                tipo_documento: str = Form(..., min_length=3, max_length=50),
                nivel_acceso: Literal["Interno", "Restringido"] = Form("Interno"),
                id_transferencia: Optional[str] = Form(None),
                id_evaluacion: Optional[str] = Form(None),
                id_movimiento: Optional[str] = Form(None),
                cn=Depends(get_db), u: dict = Depends(requiere(*PERSONAL))):
    origen = [x for x in (id_transferencia, id_evaluacion, id_movimiento) if x]
    if len(origen) != 1:
        raise HTTPException(422, "La evidencia debe respaldar exactamente una operación (transferencia, evaluación o movimiento).")
    datos = await archivo.read(config.MAX_MB_EVIDENCIA * 1024 * 1024 + 1)
    if len(datos) > config.MAX_MB_EVIDENCIA * 1024 * 1024:
        raise HTTPException(413, f"El archivo supera {config.MAX_MB_EVIDENCIA} MB.")
    if not datos:
        raise HTTPException(422, "El archivo está vacío.")
    tipo = next((t for firma, t in FIRMAS.items() if datos.startswith(firma)), None)
    if tipo is None:
        raise HTTPException(415, "Solo se aceptan imágenes JPG, PNG o documentos PDF.")
    sha = hashlib.sha256(datos).hexdigest()
    if uno(cn, "SELECT 1 AS x FROM evidencia WHERE hash_sha256 = ?", sha):
        raise HTTPException(409, "Ese archivo ya fue cargado como evidencia.")

    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}{config.TIPOS_EVIDENCIA[tipo]}"
    ruta = config.UPLOAD_DIR / nombre
    ruta.write_bytes(datos)
    try:
        nuevo = siguiente_id(cn, "evidencia", "id_evidencia", "EVI-", 4)
        ejecutar(cn, """INSERT INTO evidencia (id_evidencia, id_transferencia, id_evaluacion, id_movimiento,
                        id_usuario_carga, url_s3, hash_sha256, tipo_documento, nivel_acceso)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 nuevo, id_transferencia, id_evaluacion, id_movimiento, u["id_usuario"],
                 f"local://uploads/{nombre}", sha, tipo_documento.strip(), nivel_acceso)
    except Exception:
        ruta.unlink(missing_ok=True)          # si la base rechaza, no queda un archivo huérfano
        raise
    return uno(cn, SQL_EVI + " WHERE ev.id_evidencia = ?", nuevo)


@router.get("/{id}/archivo")
def descargar(id: str, cn=Depends(get_db), u: dict = Depends(requiere(*PERSONAL))):
    ev = uno(cn, SQL_EVI + " WHERE ev.id_evidencia = ?", id)
    if not ev:
        raise HTTPException(404, "Evidencia no encontrada.")
    if not _puede_ver(ev, u):
        raise HTTPException(403, "RN-07: evidencia restringida.")
    if not ev["url_s3"].startswith("local://"):
        raise HTTPException(404, "Esta evidencia es un dato de ejemplo y no tiene archivo cargado.")
    ruta = (config.UPLOAD_DIR / ev["url_s3"].split("/")[-1]).resolve()
    if config.UPLOAD_DIR.resolve() not in ruta.parents or not ruta.exists():
        raise HTTPException(404, "No se encontró el archivo.")
    return FileResponse(ruta, filename=f"{id}{ruta.suffix}")
