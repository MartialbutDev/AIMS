from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, companies, applications, dtr, journals, notifications, reports
from app.routers.documents import documents_router

# Debug: Print all routes from each router
print("🔍 DTR routes:", [route.path for route in dtr.router.routes])
print("🔍 Journal routes:", [route.path for route in journals.router.routes])
print("🔍 Document routes:", [route.path for route in documents_router.routes])

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(users.router, prefix="/users", tags=["Users"])
router.include_router(companies.router, prefix="/companies", tags=["Companies"])
router.include_router(applications.router, prefix="/applications", tags=["Applications"])
router.include_router(dtr.router, prefix="/dtr", tags=["DTR"])
router.include_router(journals.router, prefix="/journals", tags=["Journals"])
router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
router.include_router(reports.router, prefix="/reports", tags=["Reports"])
# ✅ NO PREFIX HERE - documents_router already has "/documents"
router.include_router(documents_router, tags=["Documents"])

print("✅ All routers registered successfully!")

# ✅ FIXED: Safely print all routes
print("📋 Final routes:")
for route in router.routes:
    if hasattr(route, 'path'):
        print(f"  {route.path}")
    elif hasattr(route, 'routes'):
        for sub_route in route.routes:
            if hasattr(sub_route, 'path'):
                print(f"  {sub_route.path}")