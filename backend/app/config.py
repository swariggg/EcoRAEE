"""Configuración de la API. Los valores salen del archivo backend/.env (no se sube a Git)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent          # carpeta backend/
load_dotenv(BASE_DIR / ".env")

# ---- Base de datos (SQL Server local) ----
DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_NAME = os.getenv("DB_NAME", "EcoRaEE_CLOUD")
# "yes" = autenticación de Windows. "no" = usuario y contraseña de SQL Server.
DB_TRUSTED = os.getenv("DB_TRUSTED", "yes").lower() in ("yes", "true", "1", "si", "sí")
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_DRIVER = os.getenv("DB_DRIVER", "")                      # vacío = se detecta solo

# ---- Seguridad ----
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_MINUTOS = int(os.getenv("JWT_MINUTOS", "120"))
INTENTOS_LOGIN_POR_MINUTO = 5

# ---- Evidencias (en local se guardan en disco; en AWS irán a S3) ----
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
MAX_MB_EVIDENCIA = 5
TIPOS_EVIDENCIA = {"image/jpeg": ".jpg", "image/png": ".png", "application/pdf": ".pdf"}

# ---- Frontend ----
FRONTEND_DIR = BASE_DIR.parent / "frontend"
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5500,http://127.0.0.1:5500"
).split(",") if o.strip()]
