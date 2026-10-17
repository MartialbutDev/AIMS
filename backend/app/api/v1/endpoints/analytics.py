from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.application import Application, ApplicationStatus
from app.models.company import Company
from app.models.user import User, UserRole

router = APIRouter()

ROLE_PRESENTATION = {
    UserRole.ADMIN: ("System overview", "Live counts and placement activity from the AIMS database."),
    UserRole.COORDINATOR: ("Placement overview", "Live student and placement activity from the AIMS database."),
    UserRole.DEAN: ("Department at a glance", "Live student and placement outcomes from the AIMS database."),
    UserRole.CAREER_CENTER: ("Career center", "Live student, partner, and placement activity from the AIMS database."),
    UserRole.HTE_SUPERVISOR: ("Hiring dashboard", "Live applications associated with your registered company profile."),
}


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
