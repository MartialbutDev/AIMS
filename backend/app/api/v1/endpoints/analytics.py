
"""Role-aware analytics for AIMS."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

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
    UserRole.ADMIN: (
        "System overview",
        "Current system totals and application activity.",
    ),
    UserRole.COORDINATOR: (
        "Placement overview",
        "Activity for your assigned students.",
    ),
    UserRole.DEAN: (
        "Department at a glance",
        "Department-wide internship progress and placements.",
    ),
    UserRole.CAREER_CENTER: (
        "Career center",
        "Student, partner, and placement activity.",
    ),
    UserRole.HTE_SUPERVISOR: (
        "Hiring dashboard",
        "Applications linked to your company profile.",
    ),
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


def _months_back(
    now: datetime,
    count: int = 6,
) -> list[datetime]:
    year, month = now.year, now.month
    result = []

    for offset in reversed(range(count)):
        absolute = year * 12 + month - 1 - offset

        result.append(
            datetime(
                absolute // 12,
                absolute % 12 + 1,
                1,
            )
        )

    return result


def _next_month(month: datetime) -> datetime:
    absolute = month.year * 12 + month.month

    return datetime(
        absolute // 12,
        absolute % 12 + 1,
        1,
    )


@router.get("/dean")
async def get_dean_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("dean")),
):
    student_rows = db.query(
        User.id,
        User.gender,
    ).filter(
        User.role == UserRole.STUDENT,
        User.is_active.is_(True),
    ).all()

    student_ids = {
        row.id
        for row in student_rows
    }

    genders = (
        "male",
        "female",
        "other",
        "prefer_not_to_say",
        "not_provided",
    )

    gender_counts = {
        gender: 0
        for gender in genders
    }

    for row in student_rows:
        gender = (
            row.gender
            if row.gender in gender_counts
            else "not_provided"
        )
        gender_counts[gender] += 1

    coordinators = db.query(User).filter(
        User.role == UserRole.COORDINATOR,
        User.is_active.is_(True),
    ).order_by(
        User.last_name,
        User.first_name,
    ).all()

    assignments = (
        db.query(CoordinatorStudentAssignment)
        .join(
            User,
            User.id == CoordinatorStudentAssignment.student_id,
        )
        .filter(
            User.role == UserRole.STUDENT,
            User.is_active.is_(True),
        )
        .all()
    )

    by_coordinator: dict[str, set[str]] = {}

    for assignment in assignments:
        by_coordinator.setdefault(
            assignment.coordinator_id,
            set(),
        ).add(assignment.student_id)

    active_coordinator_ids = {
        coordinator.id
        for coordinator in coordinators
    }

    by_coordinator = {
        coordinator_id: ids
        for coordinator_id, ids in by_coordinator.items()
        if coordinator_id in active_coordinator_ids
    }

    assigned_ids = (
        set().union(*by_coordinator.values())
        if by_coordinator
        else set()
    )

    documents_by_student: dict[str, dict[str, str]] = {}
    hours_by_student: dict[str, float] = {}

    if assigned_ids:
        documents = db.query(Document).filter(
            Document.uploaded_by.in_(assigned_ids),
            Document.type.in_(REQUIRED_DOCUMENT_TYPES),
        ).order_by(
            Document.created_at.desc()
        ).all()

        for document in documents:
            documents_by_student.setdefault(
                document.uploaded_by,
                {},
            ).setdefault(
                document.type.value,
                document.verification_status,
            )

        hours_rows = db.query(
            DTR.student_id,
            func.sum(DTR.total_hours),
        ).filter(
            DTR.student_id.in_(assigned_ids),
            DTR.status == DTRStatus.APPROVED,
        ).group_by(
            DTR.student_id
        ).all()

        for student_id, hours in hours_rows:
            hours_by_student[student_id] = max(
                0.0,
                float(hours or 0),
            )

    student_metrics: dict[
        str, tuple[float, float, bool]
    ] = {}

    required_hours = max(
        0,
        settings.REQUIRED_INTERNSHIP_HOURS,
    )

    for student_id in assigned_ids:
        statuses = documents_by_student.get(
            student_id,
            {},
        )

        verified = sum(
            statuses.get(kind.value) == "verified"
            for kind in REQUIRED_DOCUMENT_TYPES
        )

        doc_percent = (
            100 * verified / len(REQUIRED_DOCUMENT_TYPES)
        )

        ojt_percent = (
            min(
                100.0,
                hours_by_student.get(student_id, 0)
                * 100 / required_hours,
            )
            if required_hours
            else 0.0
        )

        is_complete = (
            verified == len(REQUIRED_DOCUMENT_TYPES)
            and ojt_percent >= 100
        )

        student_metrics[student_id] = (
            doc_percent,
            ojt_percent,
            is_complete,
        )

    def _summary(ids: set[str]) -> dict:
        rows = [
            student_metrics[student_id]
            for student_id in ids
            if student_id in student_metrics
        ]

        count = len(rows)

        complete = sum(
            int(row[2])
            for row in rows
        )

        return {
            "average_document_completion_percent": (
                round(sum(row[0] for row in rows) / count)
                if count else 0
            ),
            "average_ojt_completion_percent": (
                round(sum(row[1] for row in rows) / count)
                if count else 0
            ),
            "fully_complete_students": complete,
            "fully_complete_percent": (
                round(complete * 100 / count)
                if count else 0
            ),
        }

    coordinator_metrics = []

    for coordinator in coordinators:
        ids = by_coordinator.get(
            coordinator.id,
            set(),
        )

        coordinator_metrics.append({
            "coordinator_id": coordinator.id,
            "coordinator_name": (
                f"{coordinator.first_name} "
                f"{coordinator.last_name}"
            ).strip(),
            "student_count": len(ids),
            **_summary(ids),
        })

    return {
        "enrolled_student_count": len(student_rows),
        "gender_distribution": gender_counts,
        "assigned_student_count": len(assigned_ids),
        "unassigned_student_count": len(
            student_ids - assigned_ids
        ),
        **_summary(assigned_ids),
        "coordinators": coordinator_metrics,
    }


@router.get("/dashboard")
async def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = UserRole(current_user.role)

    if role not in ROLE_PRESENTATION:
        raise HTTPException(
            status_code=403,
            detail="This dashboard is not available for your role",
        )

    greeting, subtitle = ROLE_PRESENTATION[role]

    total_students = db.query(User).filter(
        User.role == UserRole.STUDENT
    ).count()

    total_staff = db.query(User).filter(
        User.role.notin_([
            UserRole.STUDENT,
            UserRole.ADMIN,
        ])
    ).count()

    active_companies = db.query(Company).filter(
        Company.is_active.is_(True)
    ).count()

    applications = db.query(Application)
    company_ids: list[str] = []

    if role == UserRole.COORDINATOR:
        applications = applications.join(
            CoordinatorStudentAssignment,
            CoordinatorStudentAssignment.student_id
            == Application.student_id,
        ).filter(
            CoordinatorStudentAssignment.coordinator_id
            == current_user.id
        )

        total_students = db.query(
            CoordinatorStudentAssignment
        ).filter(
            CoordinatorStudentAssignment.coordinator_id
            == current_user.id
        ).count()

    elif role == UserRole.HTE_SUPERVISOR:
        company_ids = [
            company_id
            for (company_id,) in db.query(Company.id).filter(
                func.lower(Company.contact_email)
                == current_user.email.lower()
            ).all()
        ]

        applications = applications.filter(
            Application.company_id.in_(company_ids)
        )

    application_count = applications.count()

    pending_count = applications.filter(
        Application.status.in_([
            ApplicationStatus.PENDING,
            ApplicationStatus.REVIEWING,
        ])
    ).count()

    accepted_application_count = applications.filter(
        Application.status == ApplicationStatus.ACCEPTED
    ).count()

    placed_students = (
        applications.filter(
            Application.status == ApplicationStatus.ACCEPTED
        )
        .with_entities(
            func.count(
                func.distinct(Application.student_id)
            )
        )
        .scalar()
        or 0
    )

    placement_rate = (
        round(placed_students / total_students * 100)
        if total_students
        else 0
    )

    if role == UserRole.ADMIN:
        specs = [
            ("Registered users", db.query(User).count(), "users", "blue"),
            ("Students", total_students, "users", "violet"),
            ("Faculty & staff", total_staff, "briefcase", "amber"),
            ("Active companies", active_companies, "chart", "green"),
        ]

    elif role == UserRole.COORDINATOR:
        specs = [
            ("Assigned students", total_students, "users", "blue"),
            ("Applications", application_count, "file", "violet"),
            ("Awaiting review", pending_count, "briefcase", "amber"),
            ("Placed students", placed_students, "chart", "green"),
        ]

    elif role == UserRole.DEAN:
        specs = [
            ("Students", total_students, "users", "blue"),
            ("Total applications", application_count, "file", "violet"),
            ("Placed students", placed_students, "briefcase", "green"),
            ("Placement rate", f"{placement_rate}%", "chart", "amber"),
        ]

    elif role == UserRole.CAREER_CENTER:
        specs = [
            ("Students", total_students, "users", "blue"),
            ("Partner companies", active_companies, "briefcase", "violet"),
            ("Applications", application_count, "file", "amber"),
            ("Placed students", placed_students, "chart", "green"),
        ]

    else:
        specs = [
            (
                "Registered company profiles",
                len(company_ids),
                "briefcase",
                "violet",
            ),
            ("Applications", application_count, "file", "blue"),
            ("Awaiting review", pending_count, "users", "amber"),
            (
                "Accepted applications",
                accepted_application_count,
                "chart",
                "green",
            ),
        ]

    metrics = [
        {
            "label": label,
            "value": (
                value
                if isinstance(value, str)
                else f"{value:,}"
            ),
            "change": "Current database total",
            "icon": icon,
            "tone": tone,
        }
        for label, value, icon, tone in specs
    ]

    now = datetime.now(timezone.utc).replace(
        tzinfo=None
    )

    months = _months_back(now)
    first = months[0]
    last = _next_month(months[-1])

    year_expr = func.extract(
        "year",
        Application.applied_date,
    )

    month_expr = func.extract(
        "month",
        Application.applied_date,
    )

    counts = (
        applications.filter(
            Application.applied_date >= first,
            Application.applied_date < last,
        )
        .with_entities(
            year_expr,
            month_expr,
            func.count(Application.id),
        )
        .group_by(
            year_expr,
            month_expr,
        )
        .all()
    )

    counts_by_month = {
        (int(year), int(month)): count
        for year, month, count in counts
    }

    chart_values = [
        counts_by_month.get(
            (month.year, month.month),
            0,
        )
        for month in months
    ]

    chart_labels = [
        month.strftime("%b")
        for month in months
    ]

    recent_query = db.query(Application).options(
        joinedload(Application.company)
    ).order_by(
        Application.applied_date.desc()
    )

    if role == UserRole.COORDINATOR:
        recent_query = recent_query.join(
            CoordinatorStudentAssignment,
            CoordinatorStudentAssignment.student_id
            == Application.student_id,
        ).filter(
            CoordinatorStudentAssignment.coordinator_id
            == current_user.id
        )

    elif role == UserRole.HTE_SUPERVISOR:
        recent_query = recent_query.filter(
            Application.company_id.in_(company_ids)
        )

    recent = recent_query.limit(5).all()
    activities = []

    for application in recent:
        company_name = (
            application.company.name
            if application.company
            else "Unknown company"
        )

        applied = application.applied_date

        hours_ago = (
            max(
                0,
                int((now - applied).total_seconds() // 3600),
            )
            if applied
            else None
        )

        activities.append({
            "title": f"Application · {application.position}",
            "detail": (
                f"{company_name} · "
                f"{application.status.value.title()}"
            ),
            "time": (
                f"{hours_ago}h ago"
                if hours_ago is not None
                else "Recently"
            ),
            "initials": (
                "".join(
                    word[0].upper()
                    for word in company_name.split()[:2]
                )
                or "CO"
            ),
            "tone": (
                "blue"
                if application.status == ApplicationStatus.PENDING
                else "green"
            ),
        })

    tasks = (
        [
            f"Review {pending_count} pending or in-review applications"
        ]
        if pending_count
        else []
    )

    return {
        "greeting": greeting,
        "subtitle": subtitle,
        "metrics": metrics,
        "activities": activities,
        "tasksTitle": (
            "Needs your attention"
            if tasks
            else "No pending reviews"
        ),
        "tasks": tasks,
        "chartTitle": "Application activity",
        "chartCaption": "Applications submitted per month",
        "chartValues": chart_values,
        "chartLabels": chart_labels,
    }
