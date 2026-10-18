
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    APP_NAME: str = "AIMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api"
    DATABASE_URL: str = "postgresql://aims:aims_password@localhost:5432/aims_db"
    ASSET_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets")
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:19000", "http://localhost:5173"]
    REDIS_URL: str = "redis://localhost:6379/0"
    TESSERACT_PATH: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    REQUIRED_INTERNSHIP_HOURS: int = 486
    GOOGLE_CLOUD_PROJECT: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Configure these before enabling password reset or email verification.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: Optional[str] = None
    PASSWORD_RESET_URL: Optional[str] = None
    EMAIL_VERIFICATION_URL: Optional[str] = None

    # In production run one dedicated notification scheduler.
    RUN_NOTIFICATION_SCHEDULER: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
