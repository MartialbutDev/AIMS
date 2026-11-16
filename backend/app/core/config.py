
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
import re
from urllib.parse import urlsplit

from typing import List, Optional

from pydantic import Field
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

    DEBUG: bool = False
    DEV_TEST_STUDENT_ID: str = ""
    DEV_BYPASS_TEST_ONBOARDING: bool = False

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

    SECRET_KEY: str = Field(default="", repr=False)

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

    PUSH_DELIVERY_ENABLED: bool = False
    EMAIL_NOTIFICATION_DELIVERY_ENABLED: bool = False
    NOTIFICATION_WEB_URL: str = ""
    EXPO_ACCESS_TOKEN: Optional[str] = None

    EMAILJS_SERVICE_ID: str = ""
    EMAILJS_OTP_TEMPLATE_ID: str = ""
    EMAILJS_PUBLIC_KEY: str = ""
    EMAILJS_PRIVATE_KEY: Optional[str] = None

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
        hide_input_in_errors=True,
    )


# ============================================================
# GLOBAL SETTINGS INSTANCE
# ============================================================

settings = Settings()


_SIGNING_KEY_ERROR = (
    "Set SECRET_KEY to an independently generated random key of at least 32 bytes "
    "before starting AIMS. Example and placeholder keys are rejected."
)


def validate_signing_key(config: Settings) -> None:
    key = config.SECRET_KEY
    normalized = re.sub(r"[^a-z0-9]", "", key.lower())
    placeholder = normalized.startswith((
        "yoursupersecret", "yoursecretkey", "yourjwtsecret",
        "replace", "changeme", "example", "placeholder",
    ))
    if (
        len(key.encode("utf-8")) < 32
        or len(set(key)) < 8
        or any(char.isspace() for char in key)
        or placeholder
    ):
        raise RuntimeError(_SIGNING_KEY_ERROR)


def validate_production_config(config: Settings) -> None:
    validate_signing_key(config)
    if config.DEBUG:
        raise RuntimeError("Set DEBUG=false on EC2.")
    if config.DEV_BYPASS_TEST_ONBOARDING:
        raise RuntimeError("Set DEV_BYPASS_TEST_ONBOARDING=false on EC2.")
    try:
        target = urlsplit(config.DATABASE_URL)
        explicit_postgres = (
            "DATABASE_URL" in config.model_fields_set
            and target.scheme.split("+", 1)[0] == "postgresql"
            and bool(target.hostname)
            and bool(target.path.strip("/"))
            and target.password not in {"aims_password", "REPLACE_PASSWORD"}
        )
    except ValueError:
        explicit_postgres = False
    if not explicit_postgres:
        raise RuntimeError("Configure DATABASE_URL for the EC2 PostgreSQL database with its own credentials.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Check AIMS backend settings without showing credential values.")
    parser.add_argument("--production", action="store_true", help="Also check EC2 debug, onboarding and database settings.")
    args = parser.parse_args()
    try:
        check = validate_production_config if args.production else validate_signing_key
        check(settings)
    except RuntimeError as error:
        parser.exit(1, f"Configuration check failed. {error}\n")
    print("AIMS configuration check passed.")
