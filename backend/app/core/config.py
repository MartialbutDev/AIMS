
"""
AIMS Application Configuration

Centralized settings for:
- FastAPI
- PostgreSQL
- Authentication
- CORS
- OCR / Tesseract
- File Storage
- Internship Requirements
- Student Onboarding Verification
- Email Services
- Google Cloud
- Notification Scheduler
"""

import os

from typing import List, Optional

from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):

    # ========================================================
    # APPLICATION SETTINGS
    # ========================================================

    APP_NAME: str = "AIMS"
    APP_VERSION: str = "1.0.0"

    DEBUG: bool = True

    API_PREFIX: str = "/api"

    # ========================================================
    # DATABASE SETTINGS
    # ========================================================

    DATABASE_URL: str = (
        "postgresql://aims:aims_password@localhost:5432/aims_db"
    )

    # ========================================================
    # FILE STORAGE SETTINGS
    # ========================================================

    ASSET_DIR: str = os.path.join(
        os.path.dirname(
            os.path.dirname(
                os.path.dirname(__file__)
            )
        ),
        "assets",
    )

    # ========================================================
    # JWT AUTHENTICATION
    # ========================================================

    SECRET_KEY: str = (
        "your-super-secret-key-change-in-production"
    )

    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ========================================================
    # CORS CONFIGURATION
    # ========================================================

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:19000",
        "http://localhost:5173",
    ]

    # ========================================================
    # REDIS CONFIGURATION
    # ========================================================

    REDIS_URL: str = "redis://localhost:6379/0"

    # ========================================================
    # OCR / TESSERACT CONFIGURATION
    # ========================================================

    TESSERACT_PATH: str = (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )

    # ========================================================
    # INTERNSHIP REQUIREMENTS
    # ========================================================

    REQUIRED_INTERNSHIP_HOURS: int = 486

    # ========================================================
    # STUDENT ONBOARDING VERIFICATION
    # ========================================================

    # Official Practicum subject codes from USTP PRISM COR.
    #
    # Example:
    # PRACTICUM_SUBJECT_CODES="IT401,IT402"
    #
    # IMPORTANT:
    # Replace these with actual USTP subject codes.
    # Do not assume the example codes are official.

    PRACTICUM_SUBJECT_CODES: str = ""

    # Current academic year expected in the COR.
    #
    # Example: 2026-2027

    CURRENT_ACADEMIC_YEAR: str = ""

    # Current semester.
    #
    # Accepted by the current validator:
    # 1      = First Semester
    # 2      = Second Semester
    # summer = Summer Term

    CURRENT_SEMESTER: str = ""

    # ========================================================
    # GOOGLE CLOUD SETTINGS
    # ========================================================

    GOOGLE_CLOUD_PROJECT: Optional[str] = None

    GCS_BUCKET_NAME: Optional[str] = None

    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # ========================================================
    # EMAIL CONFIGURATION
    # ========================================================

    SMTP_HOST: Optional[str] = None

    SMTP_PORT: int = 587

    SMTP_USERNAME: Optional[str] = None

    SMTP_PASSWORD: Optional[str] = None

    SMTP_USE_TLS: bool = True

    EMAIL_FROM: Optional[str] = None

    PASSWORD_RESET_URL: Optional[str] = None

    EMAIL_VERIFICATION_URL: Optional[str] = None

    # ========================================================
    # NOTIFICATION SCHEDULER
    # ========================================================

    RUN_NOTIFICATION_SCHEDULER: bool = True

    # ========================================================
    # ENVIRONMENT CONFIGURATION
    # ========================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# ============================================================
# GLOBAL SETTINGS INSTANCE
# ============================================================

settings = Settings()
