
"""
AIMS SQLAlchemy Models

Import all database models here so SQLAlchemy can register
them with Base.metadata.

This includes the Student Onboarding Verification System.
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
# STUDENT ONBOARDING VERIFICATION MODELS
# ============================================================

from app.models.student_onboarding import (
    StudentOnboarding,
    StudentOnboardingSubmission,
)
