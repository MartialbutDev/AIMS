
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
from app.services import reporting_scope as reporting
from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
from app.models.internship_completion import InternshipCompletionCase
from app.services.deployment_service import DeploymentService

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
        "Internship progress within your designation scope.",
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
    year, semester = reporting.get_current_academic_term()
    ids = reporting.student_ids(db,current_user,year,semester)
    coordinator_ids = reporting.dean_coordinator_ids(db,current_user,year,semester)
    coordinators = db.query(User).filter(User.id.in_(coordinator_ids),User.role==UserRole.COORDINATOR).order_by(User.last_name,User.first_name).all()
    assignments = reporting.term(db.query(CoordinatorStudentAssignment),CoordinatorStudentAssignment,year,semester).filter(
        CoordinatorStudentAssignment.student_id.in_(ids),CoordinatorStudentAssignment.coordinator_id.in_(coordinator_ids)).all()
    by_coordinator = {c.id:set() for c in coordinators}
    for assignment in assignments: by_coordinator.setdefault(assignment.coordinator_id,set()).add(assignment.student_id)
    assigned_ids = set().union(*by_coordinator.values()) if by_coordinator else set()
    genders = {key:0 for key in ('male','female','other','prefer_not_to_say','not_provided')}
    for student in db.query(User).filter(User.id.in_(ids),User.role==UserRole.STUDENT):
        genders[student.gender if student.gender in genders else 'not_provided']+=1
    required_types = tuple(DeploymentService.REQUIRED_DOCUMENTS)
    documents = reporting.term(db.query(Document),Document,year,semester).filter(Document.uploaded_by.in_(assigned_ids),
        Document.type.in_(required_types)).order_by(Document.created_at.desc(),Document.id.desc()).all()
    latest = {}
    for document in documents: latest.setdefault(document.uploaded_by,{}).setdefault(document.type,document.verification_status)
    hours = reporting.approved_hours(db,assigned_ids,year,semester)
    deps = reporting.deployments(db,current_user,year,semester)
    official = set()
    from sqlalchemy import inspect
    if inspect(db.connection()).has_table(InternshipCompletionCase.__tablename__):
        official={id for (id,) in deps.join(InternshipCompletionCase,InternshipCompletionCase.deployment_id==InternshipDeployment.id).filter(
            InternshipDeployment.status==DeploymentStatus.COMPLETED,InternshipCompletionCase.status=='completed',
            InternshipCompletionCase.approved_at.isnot(None),InternshipCompletionCase.approved_by.isnot(None)).with_entities(InternshipDeployment.student_id)}
    required_hours = max(0,settings.REQUIRED_INTERNSHIP_HOURS)
    def summary(students):
        count=len(students)
        docs=sum(sum(latest.get(id,{}).get(kind)=='verified' for kind in required_types)/len(required_types)*100 for id in students)
        progress=sum(min(100,hours.get(id,0)/required_hours*100) if required_hours else 0 for id in students)
        complete=len(students & official)
        return {'average_document_completion_percent':round(docs/count) if count else 0,
                'average_ojt_completion_percent':round(progress/count) if count else 0,
                'fully_complete_students':complete,'fully_complete_percent':round(complete/count*100) if count else 0}
    return {**reporting.term_metadata(year,semester),'enrolled_student_count':len(ids),
        'gender_distribution':genders,'assigned_student_count':len(assigned_ids),
        'unassigned_student_count':len(ids-assigned_ids) if current_user.role==UserRole.ADMIN else None,
        'unassigned_students_available':current_user.role==UserRole.ADMIN,
        'completion':reporting.completion_counts(db,deps), **summary(assigned_ids),
        'coordinators':[{'coordinator_id':c.id,'coordinator_name':f'{c.first_name} {c.last_name}',
            'student_count':len(by_coordinator[c.id]),**summary(by_coordinator[c.id])} for c in coordinators]}


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

    year, semester = reporting.get_current_academic_term()
    ids = reporting.student_ids(db,current_user,year,semester)
    total_students = len(ids)
    total_staff = db.query(User).filter(User.role.notin_([UserRole.STUDENT,UserRole.ADMIN])).count()
    active_companies = db.query(Company).filter(Company.is_active.is_(True)).count()
    applications = reporting.term(db.query(Application),Application,year,semester)
    company_ids = reporting.company_ids(db,current_user) if role==UserRole.HTE_SUPERVISOR else []
    if role==UserRole.HTE_SUPERVISOR: applications=applications.filter(Application.company_id.in_(company_ids))
    else: applications=applications.filter(Application.student_id.in_(ids))
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
            ("Registered students", total_students, "users", "violet"),
            ("Faculty & staff", total_staff, "briefcase", "amber"),
            ("Active companies", active_companies, "chart", "green"),
        ]

    elif role == UserRole.COORDINATOR:
        specs = [
            ("Assigned students", total_students, "users", "blue"),
            ("Applications", application_count, "file", "violet"),
            ("Awaiting review", pending_count, "briefcase", "amber"),
            ("Accepted students", placed_students, "chart", "green"),
        ]

    elif role == UserRole.DEAN:
        specs = [
            ("Students in scope", total_students, "users", "blue"),
            ("Total applications", application_count, "file", "violet"),
            ("Accepted students", placed_students, "briefcase", "green"),
            ("Acceptance rate", f"{placement_rate}%", "chart", "amber"),
        ]

    elif role == UserRole.CAREER_CENTER:
        specs = [
            ("Students in scope", total_students, "users", "blue"),
            ("Active company profiles", active_companies, "briefcase", "violet"),
            ("Applications", application_count, "file", "amber"),
            ("Accepted students", placed_students, "chart", "green"),
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
            "change": f"AY {year} · Semester {semester}",
            "icon": icon,
            "tone": tone,
        }
        for label, value, icon, tone in specs
    ]

    if role in (UserRole.ADMIN,UserRole.CAREER_CENTER):
        for metric in metrics:
            if metric['label'] in ('Registered users','Registered students','Faculty & staff','Active companies','Active company profiles','Students in scope'):
                metric['change']='Registered inventory · all terms'
    if role==UserRole.HTE_SUPERVISOR: metrics[0]['change']='Active supervisor assignments'
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

    recent_query = applications.options(joinedload(Application.company)).order_by(Application.applied_date.desc(),Application.id)

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
        **reporting.term_metadata(year,semester),
        "completion": reporting.completion_counts(db,reporting.deployments(db,current_user,year,semester)),
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
        "chartCaption": f"Applications in AY {year}, Semester {semester}; grouped by submission month",
        "chartValues": chart_values,
        "chartLabels": chart_labels,
    }
