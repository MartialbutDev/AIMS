import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
import uvicorn

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import router as api_v1_router
from app.services.notification_scheduler import run_notification_scheduler

# Create database tables
Base.metadata.create_all(bind=engine)

# Additive migration for existing databases created before student gender capture.
if "gender" not in {column["name"] for column in inspect(engine).get_columns("users")}:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR(24)"))

# Keep the existing PostgreSQL document enum compatible with current document types.
if engine.dialect.name == "postgresql":
    with engine.begin() as connection:
        for enum_type, enum_values in {
            "documenttype": (
                "WAIVER",
                "MEDICAL_CERTIFICATE",
                "INTERNSHIP_PLAN",
                "INSURANCE",
            ),
            "notificationtype": ("ANNOUNCEMENT",),
        }.items():
            for enum_value in enum_values:
                connection.execute(
                    text(
                        f"ALTER TYPE {enum_type} ADD VALUE IF NOT EXISTS '{enum_value}'"
                    )
                )

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_task = asyncio.create_task(run_notification_scheduler())
    try:
        yield
    finally:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Academic Internship Management System API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes (this includes documents router now)
app.include_router(api_v1_router, prefix="/api/v1")

# Create assets directory if it doesn't exist
os.makedirs(settings.ASSET_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.ASSET_DIR, "uploads"), exist_ok=True)

# Static files (for serving uploaded documents)
app.mount("/static", StaticFiles(directory=settings.ASSET_DIR), name="static")


@app.get("/")
async def root():
    return {
        "message": "Welcome to AIMS API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "AIMS API is running",
        "version": settings.APP_VERSION
    }


@app.get("/api/v1/health/db")
async def db_health_check():
    from sqlalchemy import text
    from app.core.database import engine
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)