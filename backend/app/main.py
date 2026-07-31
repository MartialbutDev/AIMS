import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import router as api_v1_router  # ← ADD THIS

from app.routers import ocr
from fastapi.staticfiles import StaticFiles

from app.routers.ocr import ocr_router
from app.models.document import Document
from app.models.user import User

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Academic Internship Management System API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True,)

# Register API routes - ADD THIS SECTION
app.include_router(api_v1_router, prefix="/api/v1")




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


#ocr
app.include_router(ocr_router)