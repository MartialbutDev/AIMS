# C:\Users\NT900X3M\AIMS\backend\app\api\v1\__init__.py
from fastapi import APIRouter
from app.api.v1.endpoints import auth, users

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(users.router, prefix="/users", tags=["Users"])