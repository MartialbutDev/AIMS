
"""
AIMS API Version 1 Router Configuration

Registers all API endpoints, including:
- Authentication
- User Management
- Companies
- Applications
- DTR
- Journals
- Documents
- Notifications
- Reports
- Analytics
- Coordinator
- Excel Export
- Student Onboarding Verification
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    companies,
    applications,
    dtr,
    journals,
    notifications,
    reports,
    excel,
    notification_settings,
    analytics,
    coordinator,
    onboarding,
)

# Existing document router
from app.routers.documents import documents_router


# ============================================================
# MAIN API ROUTER
# ============================================================

router = APIRouter()


# ============================================================
# AUTHENTICATION
# ============================================================

router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)


# ============================================================
# ANALYTICS
# ============================================================

router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["Analytics"],
)


# ============================================================
# COORDINATOR
# ============================================================

router.include_router(
    coordinator.router,
    prefix="/coordinator",
    tags=["Coordinator"],
)


# ============================================================
# USERS
# ============================================================

router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"],
)


# ============================================================
# COMPANIES
# ============================================================

router.include_router(
    companies.router,
    prefix="/companies",
    tags=["Companies"],
)


# ============================================================
# APPLICATIONS
# ============================================================

router.include_router(
    applications.router,
    prefix="/applications",
    tags=["Applications"],
)


# ============================================================
# DAILY TIME RECORD (DTR)
# ============================================================

router.include_router(
    dtr.router,
    prefix="/dtr",
    tags=["DTR"],
)


# ============================================================
# JOURNALS
# ============================================================

router.include_router(
    journals.router,
    prefix="/journals",
    tags=["Journals"],
)


# ============================================================
# NOTIFICATIONS
# ============================================================

router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["Notifications"],
)


# ============================================================
# REPORTS
# ============================================================

router.include_router(
    reports.router,
    prefix="/reports",
    tags=["Reports"],
)


# ============================================================
# DOCUMENTS
# ============================================================

# The existing documents_router already includes "/documents".
# Do not add another prefix.

router.include_router(
    documents_router,
    tags=["Documents"],
)


# ============================================================
# EXCEL EXPORT
# ============================================================

router.include_router(
    excel.router,
    prefix="/excel",
    tags=["Excel Export"],
)


# ============================================================
# NOTIFICATION SETTINGS
# ============================================================

router.include_router(
    notification_settings.router,
    prefix="/notifications",
    tags=["Notification Settings"],
)


# ============================================================
# STUDENT ONBOARDING VERIFICATION
# ============================================================

# The onboarding router already includes "/onboarding".
# Final URL: /api/v1/onboarding/...

router.include_router(
    onboarding.router,
)


# ============================================================
# DEBUG: PRINT REGISTERED ROUTES
# ============================================================

print("\n" + "=" * 60)
print("AIMS API V1 - REGISTERED ROUTES")
print("=" * 60)

for route in router.routes:
    if hasattr(route, "path"):
        methods = getattr(route, "methods", None)

        if methods:
            method_text = ", ".join(sorted(methods))
        else:
            method_text = "N/A"

        print(f"{method_text:20} {route.path}")

print("=" * 60)
print("All AIMS API routers registered successfully!")
print("=" * 60 + "\n")
