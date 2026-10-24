
"""
AIMS SQLAlchemy Models

Import all database models here so SQLAlchemy can register
them with Base.metadata.

Includes:
- Core models
- Notification models
- Coordinator models
- Dean coordinator designation
- Document review
- Student onboarding verification
"""

# ============================================================
# CORE MODELS
# ============================================================

from app.models.user import User
from app.models.company import Company
from app.models.application import Application
from app.models.document import Document
from app.models.dtr import DTR
from app.models.journal import Journal

# ============================================================
# NOTIFICATION MODELS
# ============================================================

from app.models.notification import Notification
from app.models.notification_settings import NotificationSettings
from app.models.notification_campaign import NotificationCampaign

# ============================================================
# COORDINATOR MODELS
# ============================================================

from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.coordinator_evaluation import CoordinatorEvaluation

# ============================================================
# DEAN MODELS
# ============================================================

from app.models.dean_coordinator_designation import (
    DeanCoordinatorDesignation,
)

# ============================================================
# DOCUMENT REVIEW MODELS
# ============================================================

from app.models.document_review import DocumentReview

# ============================================================
# STUDENT ONBOARDING VERIFICATION MODELS
# ============================================================

from app.models.student_onboarding import (
    StudentOnboarding,
    StudentOnboardingSubmission,
)

from app.models.push import PushDevice, PushDelivery

from app.models.completion import CompletionPlan, ClearanceItem, CompanyFinalEvaluation, InternshipCompletion, CompletionEvent
