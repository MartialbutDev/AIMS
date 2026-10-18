from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.application import Application, ApplicationStatus
from app.models.company import Company
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.document import Document, DocumentType
from app.models.dtr import DTR, DTRStatus
from app.models.user import User, UserRole

router = APIRouter()

ROLE_PRESENTATION = {
    UserRole.ADMIN: ("System overview", "Live counts and placement activity from the AIMS database."),
    UserRole.COORDINATOR: ("Placement overview", "Live student and placement activity from the AIMS database."),
    UserRole.DEAN: ("Department at a glance", "Live student and placement outcomes from the AIMS database."),
    UserRole.CAREER_CENTER: ("Career center", "Live student, partner, and placement activity from the AIMS database."),
    UserRole.HTE_SUPERVISOR: ("Hiring dashboard", "Live applications associated with your registered company profile."),
}

REQUIRED_DOCUMENT_TYPES = (
    DocumentType.RESUME,
    DocumentType.APPLICATION_LETTER,
    DocumentType.WAIVER,
    DocumentType.MEDICAL_CERTIFICATE,
    DocumentType.INTERNSHIP_PLAN,
    DocumentType.INSURANCE,
    DocumentType.ENDORSEMENT_LETTER,
    DocumentType.ACCEPTANCE_LETTER,
    DocumentType.CERTIFICATE_OF_COMPLETION,
)


def _format_count(count: int) -> str:
    return f"{count:,}"


def _months_back(now: datetime, count: int = 6) -> list[datetime]:
    first_month = datetime(now.year, now.month, 1)
    months = []
    for offset in reversed(range(count)):
        month = first_month.month - offset
        year = first_month.year
        while month <= 0:
            month += 12
            year -= 1
        months.append(datetime(year, month, 1))
    return months


@router.get("/dean")
async def get_dean_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("dean")),
):
    """Return institution-wide aggregate metrics without individual student data."""
    students = db.query(User).filter(
        User.role == UserRole.STUDENT,
        User.is_active.is_(True),
    ).all()
    student_ids = [student.id for student in students]
    genders = ("male", "female", "other", "prefer_not_to_say", "not_provided")
    gender_counts = {gender: 0 for gender in genders}
    for student in students:
        gender = student.gender if student.gender in gender_counts else "not_provided"
        gender_counts[gender] += 1

    coordinators = db.query(User).filter(
        User.role == UserRole.COORDINATOR,
        User.is_active.is_(True),
    ).order_by(User.last_name, User.first_name).all()
    assignments = db.query(CoordinatorStudentAssignment).join(
        User,
        User.id == CoordinatorStudentAssignment.student_id,
    ).filter(
        User.role == UserRole.STUDENT,
        User.is_active.is_(True),
    ).all()
    assignments_by_coordinator: dict[str, list[str]] = {}
    for assignment in assignments:
        assignments_by_coordinator.setdefault(assignment.coordinator_id, []).append(assignment.student_id)

    assigned_student_ids = {
        student_id
        for student_ids_for_coordinator in assignments_by_coordinator.values()
        for student_id in student_ids_for_coordinator
    }
    documents_by_student: dict[str, dict[str, str]] = {}
    if assigned_student_ids:
        documents = db.query(Document).filter(
            Document.uploaded_by.in_(assigned_student_ids),
            Document.type.in_(REQUIRED_DOCUMENT_TYPES),
        ).order_by(Document.created_at.desc()).all()
        for document in documents:
            student_documents = documents_by_student.setdefault(document.uploaded_by, {})
            student_documents.setdefault(document.type.value, document.verification_status)

    approved_hours_by_student: dict[str, float] = {}
    if assigned_student_ids:
        approved_dtrs = db.query(DTR).filter(
            DTR.student_id.in_(assigned_student_ids),
            DTR.status == DTRStatus.APPROVED,
        ).all()
        for record in approved_dtrs:
            approved_hours_by_student[record.student_id] = (
                approved_hours_by_student.get(record.student_id, 0.0) + (record.total_hours or 0.0)
            )

    student_metrics: dict[str, tuple[float, float, bool]] = {}
    for student_id in assigned_student_ids:
        document_statuses = documents_by_student.get(student_id, {})
        verified_count = sum(
            document_statuses.get(document_type.value) == "verified"
            for document_type in REQUIRED_DOCUMENT_TYPES
        )
        document_percent = verified_count / len(REQUIRED_DOCUMENT_TYPES) * 100
        required_hours = settings.REQUIRED_INTERNSHIP_HOURS
        ojt_percent = min(100.0, approved_hours_by_student.get(student_id, 0.0) / required_hours * 100) if required_hours else 0.0
        is_complete = verified_count == len(REQUIRED_DOCUMENT_TYPES) and ojt_percent >= 100
        student_metrics[student_id] = (document_percent, ojt_percent, is_complete)

    coordinator_metrics = []
    for coordinator in coordinators:
        coordinator_student_ids = assignments_by_coordinator.get(coordinator.id, [])
        metrics = [student_metrics[student_id] for student_id in coordinator_student_ids if student_id in student_metrics]
        count = len(metrics)
        coordinator_metrics.append({
            "coordinator_id": coordinator.id,
            "coordinator_name": f"{coordinator.first_name} {coordinator.last_name}".strip(),
            "student_count": count,
            "average_document_completion_percent": round(sum(item[0] for item in metrics) / count) if count else 0,
            "average_ojt_completion_percent": round(sum(item[1] for item in metrics) / count) if count else 0,
            "fully_complete_students": sum(item[2] for item in metrics),
            "fully_complete_percent": round(sum(item[2] for item in metrics) / count * 100) if count else 0,
        })

    metrics = [student_metrics[student_id] for student_id in assigned_student_ids if student_id in student_metrics]
    assigned_count = len(metrics)
    return {
        "enrolled_student_count": len(students),
        "gender_distribution": gender_counts,
        "assigned_student_count": len(assigned_student_ids),
        "unassigned_student_count": len(set(student_ids) - assigned_student_ids),
        "average_document_completion_percent": round(sum(item[0] for item in metrics) / assigned_count) if assigned_count else 0,
        "average_ojt_completion_percent": round(sum(item[1] for item in metrics) / assigned_count) if assigned_count else 0,
        "fully_complete_students": sum(item[2] for item in metrics),
        "fully_complete_percent": round(sum(item[2] for item in metrics) / assigned_count * 100) if assigned_count else 0,
        "coordinators": coordinator_metrics,
    }


@router.get("/dashboard")
async def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return role-aware dashboard metrics derived from persisted database rows."""
    role = UserRole(current_user.role)
    greeting, subtitle = ROLE_PRESENTATION[role]
    total_students = db.query(User).filter(User.role == UserRole.STUDENT).count()
    total_staff = db.query(User).filter(User.role != UserRole.STUDENT).count()
    active_companies = db.query(Company).filter(Company.is_active.is_(True)).count()
    all_applications = db.query(Application)

    company_ids = None
    if role == UserRole.HTE_SUPERVISOR:
        company_ids = [
            company_id
            for (company_id,) in db.query(Company.id).filter(
                func.lower(Company.contact_email) == current_user.email.lower()
            ).all()
        ]
        all_applications = all_applications.filter(Application.company_id.in_(company_ids))

    application_count = all_applications.count()
    pending_count = all_applications.filter(
        Application.status.in_([ApplicationStatus.PENDING, ApplicationStatus.REVIEWING])
    ).count()
    placed_count = all_applications.filter(
        Application.status == ApplicationStatus.ACCEPTED
    ).count()
    placement_rate = round((placed_count / application_count) * 100) if application_count else 0

    if role == UserRole.ADMIN:
        metric_specs = [
            ("Registered users", db.query(User).count(), "users", "blue"),
            ("Students", total_students, "users", "violet"),
            ("Faculty & staff", total_staff - db.query(User).filter(User.role == UserRole.ADMIN).count(), "briefcase", "amber"),
            ("Active companies", active_companies, "chart", "green"),
        ]
    elif role == UserRole.COORDINATOR:
        metric_specs = [
            ("Students", total_students, "users", "blue"),
            ("Applications", application_count, "file", "violet"),
            ("Awaiting review", pending_count, "briefcase", "amber"),
            ("Placements", placed_count, "chart", "green"),
        ]
    elif role == UserRole.DEAN:
        metric_specs = [
            ("Students", total_students, "users", "blue"),
            ("Total applications", application_count, "file", "violet"),
            ("Placed students", placed_count, "briefcase", "green"),
            ("Placement rate", f"{placement_rate}%", "chart", "amber"),
        ]
    elif role == UserRole.CAREER_CENTER:
        metric_specs = [
            ("Students", total_students, "users", "blue"),
            ("Partner companies", active_companies, "briefcase", "violet"),
            ("Applications", application_count, "file", "amber"),
            ("Placements", placed_count, "chart", "green"),
        ]
    else:
        owned_company_count = len(company_ids or [])
        metric_specs = [
            ("Registered company profiles", owned_company_count, "briefcase", "violet"),
            ("Applications", application_count, "file", "blue"),
            ("Awaiting review", pending_count, "users", "amber"),
            ("Placements", placed_count, "chart", "green"),
        ]

    metrics = [
        {
            "label": label,
            "value": value if isinstance(value, str) else _format_count(value),
            "change": "Current database total",
            "icon": icon,
            "tone": tone,
        }
        for label, value, icon, tone in metric_specs
    ]

    now = datetime.utcnow()
    months = _months_back(now)
    chart_values = []
    chart_labels = []
    for index, month in enumerate(months):
        next_month = months[index + 1] if index + 1 < len(months) else datetime(
            month.year + (1 if month.month == 12 else 0),
            1 if month.month == 12 else month.month + 1,
            1,
        )
        month_count = all_applications.filter(
            Application.applied_date >= month,
            Application.applied_date < next_month,
        ).count()
        chart_values.append(month_count)
        chart_labels.append(month.strftime("%b"))

    recent_query = db.query(Application).join(
        Company, Application.company_id == Company.id
    ).order_by(Application.applied_date.desc())
    if role == UserRole.HTE_SUPERVISOR:
        if company_ids:
            recent_query = recent_query.filter(Application.company_id.in_(company_ids))
        else:
            recent_query = recent_query.filter(Application.id == "")
    recent_applications = recent_query.limit(5).all()
    activities = [
        {
            "title": f"Application · {application.position}",
            "detail": f"{application.company.name} · {application.status.value.title()}",
            "time": (
                f"{max(0, int((now - application.applied_date).total_seconds() // 3600))}h ago"
                if application.applied_date
                else "Recently"
            ),
            "initials": "".join(
                word[0].upper() for word in application.company.name.split()[:2]
            ) or "CO",
            "tone": "blue" if application.status == ApplicationStatus.PENDING else "green",
        }
        for application in recent_applications
    ]

    tasks = []
    if pending_count:
        tasks.append(f"Review {pending_count} pending or in-review applications")

    return {
        "greeting": greeting,
        "subtitle": subtitle,
        "metrics": metrics,
        "activities": activities,
        "tasksTitle": "Needs your attention" if tasks else "No pending reviews",
        "tasks": tasks,
        "chartTitle": "Placement activity",
        "chartCaption": "Applications created per month",
        "chartValues": chart_values,
        "chartLabels": chart_labels,
    }
