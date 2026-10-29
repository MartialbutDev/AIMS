
"""
AIMS API Version 1 Router Configuration

Registers all API endpoints, including:
- Authentication
- User Management
- Companies
- Applications
- Internship Deployments
- DTR
- Journals
- Documents
- Notifications
- Reports
- Analytics
- Coordinator
- Dean Coordinator Designations
- Excel Export
- Student Onboarding Verification
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    companies,
    applications,
    deployments,
    dtr,
    journals,
    notifications,
    reports,
    excel,
    notification_settings,
    analytics,
    coordinator,
    onboarding,
    dean_coordinators,
    coordinator_reminders,
    company_monitoring,
)

# Existing document router.
from app.routers.documents import documents_router


# ============================================================
# MAIN API ROUTER
# ============================================================

router = APIRouter()
from app.api.v1.endpoints import internship_completion
router.include_router(internship_completion.router)


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
# DEAN COORDINATOR DESIGNATIONS
# ============================================================

# The coordinator designation router already defines:
# prefix="/admin/coordinators"
#
# Final endpoints:
# GET   /api/v1/admin/coordinators
# POST  /api/v1/admin/coordinators
# PATCH /api/v1/admin/coordinators/{id}/deactivate
#
# Do not add another prefix here.

router.include_router(
    dean_coordinators.router,
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
# INTERNSHIP DEPLOYMENTS
# ============================================================

# The deployments router does not define its own prefix.
#
# Final endpoints:
# GET  /api/v1/deployments/my
# GET  /api/v1/deployments/{deployment_id}
# POST /api/v1/deployments/{deployment_id}/confirm
#
# An accepted application creates a PRE_DEPLOYMENT record.
# Official deployment requires Coordinator confirmation.

router.include_router(
    deployments.router,
    prefix="/deployments",
    tags=["Internship Deployments"],
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

# The existing documents_router already includes
# the "/documents" prefix.
#
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
#
# Final URL:
# /api/v1/onboarding/...

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


# Read-only host-company intern monitoring.
router.include_router(company_monitoring.router, prefix="/company", tags=["Company monitoring"])

router.include_router(coordinator_reminders.router, prefix="/coordinator", tags=["Coordinator reminders"])

from app.api.v1.endpoints import push
router.include_router(push.router, prefix="/push", tags=["Device notifications"])

from app.api.v1.endpoints import document_templates
router.include_router(document_templates.router, prefix='/document-templates', tags=['Approved document templates'])

from app.api.v1.endpoints import direct_placements
router.include_router(direct_placements.router, prefix='/direct-placements', tags=['Direct company placements'])

from app.api.v1.endpoints import notification_delivery
router.include_router(notification_delivery.router, prefix='/notification-delivery', tags=['Notification delivery'])

from app.api.v1.endpoints import password_reset
router.include_router(password_reset.router, prefix='/auth/password-reset/otp', tags=['Password reset OTP'])

router.include_router(dean_coordinators.legacy_router)
