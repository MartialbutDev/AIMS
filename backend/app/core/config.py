
"""
AIMS Application Configuration
Supports local Windows development and Ubuntu EC2 deployment.
"""

import os
import shutil
from pathlib import Path
from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]

# Find Tesseract automatically where possible.
DEFAULT_TESSERACT_PATH = (
    shutil.which("tesseract")
    or (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.name == "nt"
        else "/usr/bin/tesseract"
    )
)


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "AIMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    DEV_TEST_STUDENT_ID: str = ""
    DEV_BYPASS_TEST_ONBOARDING: bool = False
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = (
        "postgresql://aims:aims_password@localhost:5432/aims_db"
    )
    DB_POOL_SIZE: int = 3
    DB_MAX_OVERFLOW: int = 2

    # File storage
    ASSET_DIR: str = str(BASE_DIR / "assets")

    # Authentication
    SECRET_KEY: str = "dev-only-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS: configure additional origins through .env if needed.
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:19000",
        "http://localhost:5173",
    ]

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # OCR
    TESSERACT_PATH: str = DEFAULT_TESSERACT_PATH

    # Internship requirements
    REQUIRED_INTERNSHIP_HOURS: int = 486

    # Student onboarding
    PRACTICUM_SUBJECT_CODES: str = ""
    CURRENT_ACADEMIC_YEAR: str = ""
    CURRENT_SEMESTER: str = ""

    # Google Cloud Storage, if still used by the application
    GOOGLE_CLOUD_PROJECT: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Email and push notifications
    PUSH_DELIVERY_ENABLED: bool = False
    EXPO_ACCESS_TOKEN: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: Optional[str] = None
    PASSWORD_RESET_URL: Optional[str] = None
    EMAIL_VERIFICATION_URL: Optional[str] = None

    # Notification scheduler
    RUN_NOTIFICATION_SCHEDULER: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_settings(self):
        if not self.DEBUG:
            if (
                not self.SECRET_KEY
                or self.SECRET_KEY == "dev-only-change-me"
                or len(self.SECRET_KEY) < 32
            ):
                raise ValueError(
                    "Set a strong SECRET_KEY in the environment "
                    "before running AIMS in production."
                )

            if self.DEV_BYPASS_TEST_ONBOARDING:
                raise ValueError(
                    "Development onboarding bypass must be disabled "
                    "in production."
                )

        return self


settings = Settings()
