# app/routers/__init__.py
from app.routers.documents import documents_router

print("✅ documents_router loaded:", documents_router)
print("✅ documents_router routes:", [route.path for route in documents_router.routes])