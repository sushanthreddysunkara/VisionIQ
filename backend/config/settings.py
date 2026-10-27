import os
from pathlib import Path

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if len(SECRET_KEY) < 32 or SECRET_KEY.startswith("replace_with_"):
    raise ImproperlyConfigured("Set a random DJANGO_SECRET_KEY of at least 32 characters in backend/.env.")

DEBUG = os.getenv("DJANGO_DEBUG", "false").strip().lower() in {"1", "true", "yes"}
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "visioniq",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.getenv("MYSQL_DATABASE", "vision-iq"),
        "USER": os.getenv("MYSQL_USER", ""),
        "PASSWORD": os.getenv("MYSQL_PASSWORD", ""),
        "HOST": os.getenv("MYSQL_HOST", "localhost"),
        "PORT": os.getenv("MYSQL_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "connect_timeout": 10,
            **({"ssl": {}} if os.getenv("MYSQL_SSL", "false").strip().lower() in {"1", "true", "yes"} else {}),
        },
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_URL", "http://localhost:5173").split(",")
    if origin.strip()
]
CORS_ALLOWED_ORIGINS = FRONTEND_ORIGINS
CORS_URLS_REGEX = r"^/api/.*$"
CSRF_TRUSTED_ORIGINS = FRONTEND_ORIGINS

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["visioniq.authentication.LegacyJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

def _configured_path(name, default):
    value = Path(os.getenv(name, str(default)))
    return (value if value.is_absolute() else BASE_DIR / value).resolve()


def _default_model_directory():
    candidates = [
        BASE_DIR.parent / "AIModel",
        BASE_DIR.parent / "ai_model",
        BASE_DIR.parent / "backend" / "AIModel",
        BASE_DIR.parent / "backend" / "ai_model",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    # Fall back to the default project directory name, preserving the configured env override behavior.
    return (BASE_DIR.parent / "AIModel").resolve()


DATA_DIRECTORY = _configured_path("DATA_DIRECTORY", BASE_DIR / "data")
AI_MODEL_PATH = _configured_path("AI_MODEL_PATH", _default_model_directory())
AI_VEHICLE_MODEL_PATH = _configured_path(
    "AI_VEHICLE_MODEL_PATH",
    AI_MODEL_PATH / "nh5_yolov8n_960.pt",
)
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "")
STREAM_INTERVAL = max(0.25, float(os.getenv("STREAM_INTERVAL", "2.5")))
DATA_UPLOAD_MAX_MEMORY_SIZE = 160 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
