
"""Coordinator endpoints with assignment-based access control."""

import math
import mimetypes
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.database import get_db
from app.core.security import require_role
from app.models.application import Application, ApplicationStatus
from app.models.company import Company
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.models.coordinator_evaluation import CoordinatorEvaluation
from app.models.document import Document, DocumentType
from app.models.dtr import DTR, DTRStatus
from app.models.journal import Journal, JournalStatus
from app.models.user import User, UserRole
from app.services.notification_service import NotificationService

router = APIRouter()

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


class EvaluationInput(BaseModel):
    grade: Decimal = Field(
        ge=Decimal("1.00"),
        le=Decimal("5.00"),
        max_digits=3,
        decimal_places=2,
    )
    notes: Optional[str] = Field(
        default=None,
        max_length=5000,
    )


def _current_term() -> tuple[str, str]:
    """Read the configured active term; fail closed on invalid configuration."""
    import re

    year = str(getattr(settings, "CURRENT_ACADEMIC_YEAR", "") or "").strip()
    semester = str(
        getattr(settings, "CURRENT_SEMESTER", None)
        or getattr(settings, "PRACTICUM_SEMESTER", "")
    ).strip()
    match = re.fullmatch(r"(\d{4})-(\d{4})", year)
    if not match or int(match.group(2)) != int(match.group(1)) + 1:
        raise HTTPException(503, "CURRENT_ACADEMIC_YEAR is invalid or missing")
    if semester not in ("1", "2"):
        raise HTTPException(503, "CURRENT_SEMESTER must be 1 or 2")
    return year, semester


def _has_active_designation(db: Session, actor: User) -> bool:
    year, semester = _current_term()
    return db.query(DeanCoordinatorDesignation.id).filter(
        DeanCoordinatorDesignation.coordinator_id == actor.id,
        DeanCoordinatorDesignation.academic_year == year,
        DeanCoordinatorDesignation.semester == semester,
        DeanCoordinatorDesignation.is_active.is_(True),
    ).first() is not None


def require_assigned_student(
    db: Session,
    actor: User,
    student_id: str,
    *,
    mode: Literal["read", "write"] = "read",
) -> User:
    """Authorize current-term access. Historical data uses its own safe listing."""
    student = db.query(User).filter(
        User.id == student_id,
        User.role == UserRole.STUDENT,
    ).first()
    if student is None:
        raise HTTPException(404, "Student not found")
    if actor.role == UserRole.ADMIN:
        return student
    if actor.role != UserRole.COORDINATOR:
        raise HTTPException(403, "Coordinator role required")

    year, semester = _current_term()
    assignment = db.query(CoordinatorStudentAssignment.id).filter(
        CoordinatorStudentAssignment.coordinator_id == actor.id,
        CoordinatorStudentAssignment.student_id == student_id,
        CoordinatorStudentAssignment.academic_year == year,
        CoordinatorStudentAssignment.semester == semester,
    ).first()
    if assignment is None:
        historical = db.query(CoordinatorStudentAssignment.id).filter(
            CoordinatorStudentAssignment.coordinator_id == actor.id,
            CoordinatorStudentAssignment.student_id == student_id,
        ).first()
        if historical and mode == "write":
            raise HTTPException(403, "Historical assignments are read-only")
        raise HTTPException(404, "No current-term assignment for this student")
    if mode == "write" and not _has_active_designation(db, actor):
        raise HTTPException(403, "Active Dean designation required for this term")
    return student


def _reject_ambiguous_record_write(db: Session, student_id: str) -> None:
    """Fail closed if a student's records span multiple assigned terms.

    Application, DTR, Journal and Evaluation models in this endpoint do not
    provide a verified academic-term relationship. An assignment alone does
    not prove which term a record belongs to.
    """
    assignments = db.query(CoordinatorStudentAssignment.id).filter(
        CoordinatorStudentAssignment.student_id == student_id
    ).limit(2).all()
    if len(assignments) > 1:
        raise HTTPException(
            409,
            "Record's academic term cannot be verified across multiple "
            "student assignments; term-scoped records are required",
        )


def _hours_summary(records: list[DTR]) -> dict:
    approved = [
        record
        for record in records
        if record.status == DTRStatus.APPROVED
    ]

    total_hours = round(
        sum(
            max(0.0, float(record.total_hours or 0))
            for record in approved
        ),
        2,
    )

    required_hours = max(
        0,
        settings.REQUIRED_INTERNSHIP_HOURS,
    )

    remaining_hours = round(
        max(0, required_hours - total_hours),
        2,
    )

    progress = (
        min(100, round(total_hours / required_hours * 100))
        if required_hours
        else 0
    )

    daily_hours: dict[date, float] = {}

    for entry in approved:
        if entry.date is not None and (entry.total_hours or 0) > 0:
            day = entry.date.date()

            daily_hours[day] = (
                daily_hours.get(day, 0.0)
                + float(entry.total_hours)
            )

    average_daily_hours = (
        sum(daily_hours.values()) / len(daily_hours)
        if daily_hours
        else None
    )

    days_left = (
        math.ceil(remaining_hours / average_daily_hours)
        if remaining_hours and average_daily_hours
        else 0 if not remaining_hours else None
    )

    return {
        "required_hours": required_hours,
        "approved_hours": total_hours,
        "remaining_hours": remaining_hours,
        "progress_percent": progress,
        "remaining_percent": 100 - progress,
        "average_approved_hours_per_day": (
            round(average_daily_hours, 2)
            if average_daily_hours is not None
            else None
        ),
        "estimated_days_left": days_left,
        "approved_dtr_count": len(approved),
        "pending_dtr_count": sum(
            record.status in (
                DTRStatus.PENDING,
                DTRStatus.SUBMITTED,
            )
            for record in records
        ),
        "rejected_dtr_count": sum(
            record.status == DTRStatus.REJECTED
            for record in records
        ),
    }


def _file_response(
    relative_path: Optional[str],
    filename: Optional[str],
) -> FileResponse:
    if not relative_path or os.path.isabs(relative_path):
        raise HTTPException(
            status_code=404,
            detail="File is not available",
        )

    asset_root = os.path.realpath(settings.ASSET_DIR)
    file_path = os.path.realpath(
        os.path.join(asset_root, relative_path)
    )

    try:
        is_contained = (
            os.path.commonpath((asset_root, file_path))
            == asset_root
        )
    except ValueError:
        is_contained = False

    if not is_contained or not os.path.isfile(file_path):
        raise HTTPException(
            status_code=404,
            detail="File is not available",
        )

    return FileResponse(
        file_path,
        media_type=(
            mimetypes.guess_type(file_path)[0]
            or "application/octet-stream"
        ),
        filename=os.path.basename(filename or file_path),
        content_disposition_type="inline",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/students")
async def list_students(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    query = db.query(User).filter(
        User.role == UserRole.STUDENT
    )

    if current_user.role != UserRole.ADMIN:
        year, semester = _current_term()
        query = query.join(
            CoordinatorStudentAssignment,
            CoordinatorStudentAssignment.student_id == User.id,
        ).filter(
            CoordinatorStudentAssignment.coordinator_id == current_user.id,
            CoordinatorStudentAssignment.academic_year == year,
            CoordinatorStudentAssignment.semester == semester,
        )

    if search and search.strip():
        term = f"%{search.strip()}%"

        query = query.filter(
            User.first_name.ilike(term)
            | User.last_name.ilike(term)
            | User.email.ilike(term)
            | User.student_id.ilike(term)
        )

    total = query.count()

    students = (
        query.order_by(User.last_name, User.first_name)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    student_ids = [student.id for student in students]

    if not student_ids:
        return {
            "items": [],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total / limit),
        }

    documents = (
        db.query(Document)
        .filter(Document.uploaded_by.in_(student_ids))
        .order_by(Document.created_at.desc())
        .all()
    )

    dtrs = db.query(DTR).filter(
        DTR.student_id.in_(student_ids)
    ).all()

    applications = db.query(Application).filter(
        Application.student_id.in_(student_ids)
    ).all()

    evaluations = db.query(CoordinatorEvaluation).filter(
        CoordinatorEvaluation.coordinator_id == current_user.id,
        CoordinatorEvaluation.student_id.in_(student_ids),
    ).all()

    docs_by_student: dict[str, list[Document]] = {}
    dtrs_by_student: dict[str, list[DTR]] = {}
    apps_by_student: dict[str, list[Application]] = {}

    evaluations_by_student = {
        evaluation.student_id: evaluation
        for evaluation in evaluations
    }

    for document in documents:
        docs_by_student.setdefault(
            document.uploaded_by, []
        ).append(document)

    for dtr in dtrs:
        dtrs_by_student.setdefault(
            dtr.student_id, []
        ).append(dtr)

    for application in applications:
        apps_by_student.setdefault(
            application.student_id, []
        ).append(application)

    items = []

    for student in students:
        latest: dict[str, Document] = {}

        for document in docs_by_student.get(student.id, []):
            latest.setdefault(
                document.type.value,
                document,
            )

        statuses = [
            {
                "type": kind.value,
                "status": (
                    latest[kind.value].verification_status
                    if kind.value in latest
                    else "missing"
                ),
            }
            for kind in REQUIRED_DOCUMENT_TYPES
        ]

        verified = sum(
            item["status"] == "verified"
            for item in statuses
        )

        student_apps = apps_by_student.get(student.id, [])

        items.append({
            "id": student.id,
            "student_id": student.student_id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "phone": student.phone,
            "is_active": student.is_active,
            "documents_verified": verified,
            "documents_required": len(REQUIRED_DOCUMENT_TYPES),
            "documents_progress_percent": round(
                verified / len(REQUIRED_DOCUMENT_TYPES) * 100
            ),
            "application_count": len(student_apps),
            "application_statuses": {
                status: sum(
                    application.status.value == status
                    for application in student_apps
                )
                for status in (
                    "pending",
                    "reviewing",
                    "interview",
                    "accepted",
                    "rejected",
                    "withdrawn",
                )
            },
            "journey": _hours_summary(
                dtrs_by_student.get(student.id, [])
            ),
            "grade": (
                float(evaluations_by_student[student.id].grade)
                if student.id in evaluations_by_student
                else None
            ),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit),
    }


@router.get("/historical-students")
async def list_historical_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    """Historical assignment metadata only; never leaks cross-term records."""
    year, semester = _current_term()
    rows = (
        db.query(CoordinatorStudentAssignment, User)
        .join(User, User.id == CoordinatorStudentAssignment.student_id)
        .filter(
            CoordinatorStudentAssignment.coordinator_id == current_user.id,
            User.role == UserRole.STUDENT,
        )
        .order_by(
            CoordinatorStudentAssignment.academic_year.desc(),
            CoordinatorStudentAssignment.semester.desc(),
            User.last_name,
        )
        .all()
    )
    return {"items": [
        {
            "assignment_id": assignment.id,
            "student_id": student.id,
            "student_number": student.student_id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "academic_year": assignment.academic_year,
            "semester": assignment.semester,
            "read_only": True,
        }
        for assignment, student in rows
        if (assignment.academic_year, assignment.semester) != (year, semester)
    ]}


@router.get("/students/{student_id}")
async def get_student_detail(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    student = require_assigned_student(
        db, current_user, student_id
    )

    year, semester = _current_term()

    documents = (
        db.query(Document)
        .filter(Document.uploaded_by == student.id, Document.academic_year == year, Document.semester == semester)
        .order_by(Document.created_at.desc())
        .all()
    )

    dtrs = (
        db.query(DTR)
        .filter(DTR.student_id == student.id, DTR.academic_year == year, DTR.semester == semester)
        .order_by(DTR.date.desc())
        .all()
    )

    application_rows = (
        db.query(Application, Company.name)
        .outerjoin(
            Company,
            Company.id == Application.company_id,
        )
        .filter(Application.student_id == student.id, Application.academic_year == year, Application.semester == semester)
        .order_by(Application.applied_date.desc())
        .all()
    )

    journals = (
        db.query(Journal)
        .filter(Journal.student_id == student.id, Journal.academic_year == year, Journal.semester == semester)
        .order_by(Journal.week.desc())
        .all()
    )

    evaluation = db.query(CoordinatorEvaluation).filter(
        CoordinatorEvaluation.coordinator_id == current_user.id,
        CoordinatorEvaluation.student_id == student.id,
    ).first()

    latest: dict[str, Document] = {}

    for document in documents:
        latest.setdefault(
            document.type.value,
            document,
        )

    return {
        "academic_year": _current_term()[0],
        "semester": _current_term()[1],
        "read_only": False,
        "student": {
            "id": student.id,
            "student_id": student.student_id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "phone": student.phone,
            "is_active": student.is_active,
        },
        "journey": _hours_summary(dtrs),
        "document_statuses": [
            {
                "type": kind.value,
                "status": (
                    latest[kind.value].verification_status
                    if kind.value in latest
                    else "missing"
                ),
            }
            for kind in REQUIRED_DOCUMENT_TYPES
        ],
        "documents": [
            {
                "id": document.id,
                "type": document.type.value,
                "filename": document.original_filename,
                "status": document.verification_status,
                "created_at": document.created_at,
            }
            for document in documents
        ],
        "applications": [
            {
                "id": application.id,
                "position": application.position,
                "company": company_name,
                "status": application.status.value,
                "applied_date": application.applied_date,
            }
            for application, company_name in application_rows
        ],
        "dtr_records": [
            {
                "id": entry.id,
                "date": entry.date,
                "time_in": entry.time_in,
                "time_out": entry.time_out,
                "total_hours": entry.total_hours,
                "status": entry.status.value,
                "tasks_completed": entry.tasks_completed,
                "notes": entry.notes,
                "image_in_available": bool(entry.image_in_path),
                "image_out_available": bool(entry.image_out_path),
            }
            for entry in dtrs
        ],
        "journals": [
            {
                "id": journal.id,
                "week": journal.week,
                "title": journal.title,
                "status": journal.status.value,
                "summary": journal.summary,
            }
            for journal in journals
        ],
        "evaluation": (
            {
                "grade": float(evaluation.grade),
                "notes": evaluation.notes,
                "updated_at": evaluation.updated_at,
            }
            if evaluation
            else None
        ),
    }


@router.put("/students/{student_id}/evaluation")
async def save_student_evaluation(
    student_id: str,
    evaluation_data: EvaluationInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    student = require_assigned_student(
        db, current_user, student_id, mode="write"
    )
    _reject_ambiguous_record_write(db, student_id)

    evaluation = db.query(CoordinatorEvaluation).filter(
        CoordinatorEvaluation.coordinator_id == current_user.id,
        CoordinatorEvaluation.student_id == student.id,
    ).first()

    if evaluation is None:
        evaluation = CoordinatorEvaluation(
            coordinator_id=current_user.id,
            student_id=student.id,
            grade=evaluation_data.grade,
            notes=evaluation_data.notes,
        )
        db.add(evaluation)
    else:
        evaluation.grade = evaluation_data.grade
        evaluation.notes = evaluation_data.notes

    db.commit()
    db.refresh(evaluation)

    return {
        "grade": float(evaluation.grade),
        "notes": evaluation.notes,
        "updated_at": evaluation.updated_at,
    }


@router.get("/students/{student_id}/documents/{document_id}/file")
async def get_student_document_file(
    student_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    require_assigned_student(
        db, current_user, student_id
    )

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.uploaded_by == student_id,
    ).first()

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return _file_response(
        document.file_path,
        document.original_filename,
    )


@router.get("/students/{student_id}/dtr/{dtr_id}/photo/{photo_type}")
async def get_student_dtr_photo(
    student_id: str,
    dtr_id: str,
    photo_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    require_assigned_student(
        db, current_user, student_id
    )

    if photo_type not in ("in", "out"):
        raise HTTPException(
            status_code=400,
            detail="Photo type must be 'in' or 'out'",
        )

    entry = db.query(DTR).filter(
        DTR.id == dtr_id,
        DTR.student_id == student_id,
    ).first()

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="DTR entry not found",
        )

    relative_path = (
        entry.image_in_path
        if photo_type == "in"
        else entry.image_out_path
    )

    return _file_response(
        relative_path,
        os.path.basename(relative_path or ""),
    )


# ============================================================
# ASSIGNMENT-SCOPED REVIEW WORKSPACE
# ============================================================

class ApplicationReviewInput(BaseModel):
    status: Literal["reviewing", "interview", "accepted", "rejected"]


class RecordReviewInput(BaseModel):
    status: Literal["approved", "rejected"]


def _visible_student_ids(db: Session, actor: User) -> list[str]:
    if actor.role == UserRole.ADMIN:
        rows = db.query(User.id).filter(User.role == UserRole.STUDENT).all()
    else:
        if not _has_active_designation(db, actor):
            return []
        year, semester = _current_term()
        rows = db.query(CoordinatorStudentAssignment.student_id).filter(
            CoordinatorStudentAssignment.coordinator_id == actor.id,
            CoordinatorStudentAssignment.academic_year == year,
            CoordinatorStudentAssignment.semester == semester,
        ).all()
    return [row[0] for row in rows]


def _notify_safely(callback) -> None:
    # A notification failure must not undo a saved review.
    try:
        callback()
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(
            "Review notification failed: %s",
            exc,
        )


@router.get("/review-queue")
async def get_review_queue(
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    """Return review records for assigned students only."""

    ids = _visible_student_ids(db, current_user)

    if not ids:
        return {
            "applications": [],
            "dtrs": [],
            "journals": [],
        }

    students = db.query(User).filter(
        User.id.in_(ids)
    ).all()

    names = {
        student.id: (
            f"{student.first_name} {student.last_name}".strip()
        )
        for student in students
    }

    app_rows = (
        db.query(Application, Company.name)
        .outerjoin(
            Company,
            Company.id == Application.company_id,
        )
        .filter(Application.student_id.in_(ids))
        .order_by(Application.applied_date.desc())
        .limit(limit)
        .all()
    )

    dtrs = (
        db.query(DTR)
        .filter(
            DTR.student_id.in_(ids),
            DTR.status != DTRStatus.PENDING,
        )
        .order_by(DTR.date.desc())
        .limit(limit)
        .all()
    )

    journals = (
        db.query(Journal)
        .filter(
            Journal.student_id.in_(ids),
            Journal.status != JournalStatus.DRAFT,
        )
        .order_by(Journal.week.desc())
        .limit(limit)
        .all()
    )

    return {
        "applications": [
            {
                "id": app.id,
                "student_id": app.student_id,
                "student_name": names.get(
                    app.student_id, "Student"
                ),
                "company_name": company_name,
                "position": app.position,
                "status": app.status.value,
                "applied_date": app.applied_date,
            }
            for app, company_name in app_rows
        ],
        "dtrs": [
            {
                "id": entry.id,
                "student_id": entry.student_id,
                "student_name": names.get(
                    entry.student_id, "Student"
                ),
                "date": entry.date,
                "time_in": entry.time_in,
                "time_out": entry.time_out,
                "total_hours": entry.total_hours,
                "status": entry.status.value,
                "tasks_completed": entry.tasks_completed,
                "image_in_available": bool(
                    entry.image_in_path
                ),
                "image_out_available": bool(
                    entry.image_out_path
                ),
            }
            for entry in dtrs
        ],
        "journals": [
            {
                "id": entry.id,
                "student_id": entry.student_id,
                "student_name": names.get(
                    entry.student_id, "Student"
                ),
                "week": entry.week,
                "title": entry.title,
                "summary": entry.summary,
                "status": entry.status.value,
            }
            for entry in journals
        ],
    }


@router.put("/review-queue/applications/{application_id}")
async def review_application(
    application_id: str,
    review: ApplicationReviewInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    app = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if app is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    require_assigned_student(
        db,
        current_user,
        app.student_id,
        mode="write",
    )
    _reject_ambiguous_record_write(db, app.student_id)

    if app.status not in (
        ApplicationStatus.PENDING,
        ApplicationStatus.REVIEWING,
        ApplicationStatus.INTERVIEW,
    ):
        raise HTTPException(
            status_code=409,
            detail="This application can no longer be reviewed",
        )

    old_status = app.status
    app.status = ApplicationStatus(review.status)
    app.updated_date = func.now()

    db.commit()
    db.refresh(app)

    if app.status != old_status:
        company = db.query(Company).filter(
            Company.id == app.company_id
        ).first()

        _notify_safely(
            lambda: NotificationService.create_application_notification(
                db=db,
                user_id=app.student_id,
                application_id=app.id,
                status=app.status.value,
                company_name=(
                    company.name
                    if company
                    else "the company"
                ),
            )
        )

    return {
        "id": app.id,
        "status": app.status.value,
    }


@router.put("/review-queue/dtrs/{dtr_id}")
async def review_dtr(
    dtr_id: str,
    review: RecordReviewInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    entry = db.query(DTR).filter(
        DTR.id == dtr_id
    ).first()

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="DTR not found",
        )

    require_assigned_student(
        db,
        current_user,
        entry.student_id,
        mode="write",
    )
    _reject_ambiguous_record_write(db, entry.student_id)

    if entry.status != DTRStatus.SUBMITTED:
        raise HTTPException(
            status_code=409,
            detail="Only submitted DTRs may be reviewed",
        )

    if entry.time_out is None:
        raise HTTPException(
            status_code=409,
            detail="A DTR requires time-out before review",
        )

    entry.status = DTRStatus(review.status)
    entry.approved_date = datetime.utcnow()
    entry.updated_at = func.now()

    db.commit()
    db.refresh(entry)

    _notify_safely(
        lambda: NotificationService.create_dtr_notification(
            db=db,
            user_id=entry.student_id,
            dtr_id=entry.id,
            status=entry.status.value,
            date=(
                entry.date.strftime("%b %d, %Y")
                if entry.date
                else "Unknown date"
            ),
        )
    )

    return {
        "id": entry.id,
        "status": entry.status.value,
    }


@router.put("/review-queue/journals/{journal_id}")
async def review_journal(
    journal_id: str,
    review: RecordReviewInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    entry = db.query(Journal).filter(
        Journal.id == journal_id
    ).first()

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    require_assigned_student(
        db,
        current_user,
        entry.student_id,
        mode="write",
    )
    _reject_ambiguous_record_write(db, entry.student_id)

    if entry.status not in (
        JournalStatus.SUBMITTED,
        JournalStatus.REVIEWING,
    ):
        raise HTTPException(
            status_code=409,
            detail="Only submitted journals may be reviewed",
        )

    entry.status = JournalStatus(review.status)
    entry.approved_date = datetime.utcnow()
    entry.updated_at = func.now()

    db.commit()
    db.refresh(entry)

    _notify_safely(
        lambda: NotificationService.create_journal_notification(
            db=db,
            user_id=entry.student_id,
            journal_id=entry.id,
            status=entry.status.value,
            week=entry.week,
        )
    )

    return {
        "id": entry.id,
        "status": entry.status.value,
    }


@router.get("/students/{student_id}/journals/{journal_id}/file")
async def get_assigned_student_journal_file(
    student_id: str,
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("coordinator")),
):
    require_assigned_student(
        db,
        current_user,
        student_id,
    )

    journal = db.query(Journal).filter(
        Journal.id == journal_id,
        Journal.student_id == student_id,
    ).first()

    if journal is None:
        raise HTTPException(
            status_code=404,
            detail="Journal not found",
        )

    return _file_response(
        journal.file_path,
        f"journal_week_{journal.week}.pdf",
    )
