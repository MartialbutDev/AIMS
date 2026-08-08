from typing import List, Optional
from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "AIMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "postgresql://aims:aims_password@localhost:5432/aims_db"

    # OCR - FIXED: Correct path to assets folder
    ASSET_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets")

    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:19000", "http://localhost:5173"]

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Tesseract
    TESSERACT_PATH: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    # Google Cloud (Optional)
    GOOGLE_CLOUD_PROJECT: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()