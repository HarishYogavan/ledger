import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "ledger-dev-secret-key-2026")
    
    # Check if running in Vercel or serverless environment
    is_serverless = bool(
        os.getenv("VERCEL")
        or os.getenv("VERCEL_ENV")
        or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
        or os.getenv("LAMBDA_TASK_ROOT")
        or os.path.exists("/var/task")
    )
    
    if is_serverless:
        # In serverless/Lambda, only /tmp is writable
        db_file = Path("/tmp/ledger.db")
        seed_file = BASE_DIR / "ledger.db"
        if not db_file.exists() and seed_file.exists():
            try:
                import shutil
                shutil.copyfile(str(seed_file), str(db_file))
            except Exception:
                pass
        DATABASE_PATH = str(db_file)
        UPLOAD_FOLDER = "/tmp/uploads"
    else:
        raw_db_path = os.getenv("DATABASE_PATH", str(BASE_DIR / "ledger.db"))
        DATABASE_PATH = str(BASE_DIR / raw_db_path) if not os.path.isabs(raw_db_path) else raw_db_path
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

