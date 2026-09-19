import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "ledger-dev-secret-key-2026")
    
    # Check if running in Vercel or serverless environment
    is_vercel = bool(os.getenv("VERCEL"))
    if is_vercel:
        DATABASE_PATH = os.getenv("DATABASE_PATH", "/tmp/ledger.db")
        UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "/tmp/uploads")
    else:
        DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "ledger.db"))
        UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))

    db_url = os.getenv("DATABASE_URL")
    if db_url:
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        SQLALCHEMY_DATABASE_URI = db_url
    else:
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"check_same_thread": False}
    } if "sqlite" in SQLALCHEMY_DATABASE_URI else {}

    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7 days

