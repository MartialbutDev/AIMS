
"""AIMS FastAPI application entry point."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.core.config import settings
from app.core.database import Base, engine
import app.models
from app.api.v1 import router as api_v1_router
from app.services.notification_scheduler import run_notification_scheduler

logger = logging.getLogger(__name__)


def ensure_database_schema() -> None:
    """Development bootstrap. Use Alembic for real migrations."""

    from app.models.document_template import TEMPLATE_TABLES
    from app.models.direct_placement import DIRECT_PLACEMENT_TABLES
    from app.models.notification_delivery import DELIVERY_TABLES
    from app.models.password_reset import PASSWORD_RESET_TABLES
    from app.models.internship_completion import COMPLETION_TABLES
    from app.models.auth_session import SESSION_TABLES
    Base.metadata.create_all(bind=engine, tables=[t for t in Base.metadata.sorted_tables if t.name not in (TEMPLATE_TABLES | DIRECT_PLACEMENT_TABLES | DELIVERY_TABLES | PASSWORD_RESET_TABLES | COMPLETION_TABLES | SESSION_TABLES)])

    inspector = inspect(engine)

    if inspector.has_table("users"):
        columns = {
            column["name"]
            for column in inspector.get_columns("users")
        }

        if "gender" not in columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN gender VARCHAR(24)"
                    )
                )

    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            enum_values = {
                "documenttype": (
                    "WAIVER",
                    "MEDICAL_CERTIFICATE",
                    "INTERNSHIP_PLAN",
                    "INSURANCE",
                ),
                "notificationtype": (
                    "ANNOUNCEMENT",
                ),
            }

            for enum_name, values in enum_values.items():
                for value in values:
                    connection.execute(
                        text(
                            f"ALTER TYPE {enum_name} "
                            f"ADD VALUE IF NOT EXISTS '{value}'"
                        )
                    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    if (
        not settings.DEBUG
        and settings.SECRET_KEY
        == "your-super-secret-key-change-in-production"
    ):
        raise RuntimeError(
            "Set a secure SECRET_KEY before running AIMS in production"
        )

    ensure_database_schema()

    scheduler_task = None

    if settings.RUN_NOTIFICATION_SCHEDULER:
        scheduler_task = asyncio.create_task(
            run_notification_scheduler()
        )

    try:
        yield
    finally:
        if scheduler_task is not None:
            scheduler_task.cancel()

            try:
                await scheduler_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Academic Internship Management System API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    api_v1_router,
    prefix="/api/v1",
)

# Do not expose all uploaded student documents and DTR photos.
avatar_dir = os.path.join(
    settings.ASSET_DIR,
    "avatars",
)

os.makedirs(
    avatar_dir,
    exist_ok=True,
)

app.mount(
    "/static/avatars",
    StaticFiles(directory=avatar_dir),
    name="public_avatars",
)


@app.get("/")
async def root():
    return {
        "message": "Welcome to AIMS API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
    }


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "AIMS API is running",
        "version": settings.APP_VERSION,
    }


@app.get("/api/v1/health/db")
async def db_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except Exception:
        logger.exception(
            "AIMS database health check failed"
        )

        raise HTTPException(
            status_code=503,
            detail="Database is unavailable",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
