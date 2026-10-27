from app.services import direct_placement_service as direct_service

import math
import uuid

from datetime import datetime
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.assignment_access import (
    ensure_coordinator_student_access,
    get_current_academic_term,
)
from app.core.security import get_current_user, require_role

from app.models.user import User, UserRole
from app.models.company import Company
from app.models.application import Application, ApplicationStatus
from app.models.document import Document
from app.models.hte_supervisor_company import HTESupervisorCompany

from app.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
)
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import NotificationService
from app.services.deployment_service import DeploymentService


router = APIRouter()


def _to_response(
    application: Application,
    company_name: str | None,
) -> ApplicationResponse:
    return ApplicationResponse.model_validate(
        application
    ).model_copy(
        update={"company_name": company_name, "student_name": f"{application.student.first_name} {application.student.last_name}" if application.student else None}
    )


def _company_name_map(
    db: Session,
    items: List[Application],
) -> dict[str, str]:
    ids = {
        item.company_id
        for item in items
        if item.company_id
    }

    if not ids:
        return {}

    rows = (
        db.query(Company.id, Company.name)
        .filter(Company.id.in_(ids))
        .all()
    )

    return {
        company_id: name
        for company_id, name in rows
    }


def _paginate(query, page: int, limit: int):
    total = query.count()

    items = (
        query.offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return items, total


def _current_term():
    return get_current_academic_term()


def _require_current_application(
    application: Application,
) -> None:
    academic_year, semester = _current_term()

    if (
        application.academic_year != academic_year
        or application.semester != semester
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Historical or unclassified applications "
                "cannot be modified."
            ),
        )


def _require_hte_company_access(
    db: Session,
    actor: User,
    company_id: str,
) -> None:
    if actor.role != UserRole.HTE_SUPERVISOR:
        raise HTTPException(
            status_code=403,
            detail="HTE Supervisor access required",
        )

    assignment = (
        db.query(HTESupervisorCompany)
        .filter(
            HTESupervisorCompany.supervisor_id == actor.id,
            HTESupervisorCompany.company_id == company_id,
            HTESupervisorCompany.is_active.is_(True),
        )
        .first()
    )

    if assignment is None:
        raise HTTPException(
            status_code=403,
            detail=(
                "You are not authorized to manage "
                "applications for this company."
            ),
        )


def _validate_document_ownership(
    db: Session,
    document_id: str | None,
    student_id: str,
    field_label: str,
    expected_type: str,
    academic_year: str,
    semester: str,
) -> Document | None:
    if not document_id:
        return None

    doc = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_label}: document not found",
        )

    if doc.uploaded_by != student_id:
        raise HTTPException(
            status_code=403,
            detail=f"{field_label}: document does not belong to you",
        )

    doc_type = getattr(doc.type, "value", doc.type)

    if doc_type != expected_type:
        raise HTTPException(
            status_code=400,
            detail=f"{field_label}: incorrect document type",
        )

    if (
        doc.academic_year != academic_year
        or doc.semester != semester
    ):
        raise HTTPException(
            status_code=400,
            detail=f"{field_label}: document belongs to another term",
        )

    if doc.verification_status != "verified":
        raise HTTPException(
            status_code=400,
            detail=f"{field_label}: document must be verified",
        )

    return doc


def _notify_application_status(
    db: Session,
    application: Application,
    new_status: ApplicationStatus,
    company_name: str,
) -> None:
    try:
        NotificationService.create_application_notification(
            db=db,
            user_id=application.student_id,
            application_id=application.id,
            status=new_status.value,
            company_name=company_name,
        )
    except Exception as exc:
        print(f"Application notification failed: {exc}")
        db.rollback()


def _get_application(
    db: Session,
    application_id: str,
    *,
    lock: bool = False,
) -> Application:
    query = db.query(Application).filter(
        Application.id == application_id
    )

    if lock:
        identity = db.query(Application.student_id).filter(Application.id == application_id).first()
        if identity:
            db.query(User).filter(User.id == identity[0]).with_for_update().first()
        query = query.populate_existing().with_for_update(
            of=Application,
        )

    application = query.first()

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    return application


def _get_company_name(
    db: Session,
    company_id: str,
) -> str:
    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    return company.name if company else "the company"


# ============================================================
# STUDENT: CREATE APPLICATION
# ============================================================

@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_application(
    application_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Only students can apply",
        )

    academic_year, semester = _current_term()
    db.query(User).filter(User.id == current_user.id).with_for_update().first()
    direct_service.require_no_direct_conflict(db, current_user.id, academic_year, semester)

    company = (
        db.query(Company)
        .filter(
            Company.id == application_data.company_id,
            Company.is_active.is_(True),
        )
        .first()
    )

    if company is None:
        raise HTTPException(
            status_code=404,
            detail="Active company not found",
        )

    existing = (
        db.query(Application)
        .filter(
            Application.student_id == current_user.id,
            Application.company_id == application_data.company_id,
            Application.position == application_data.position,
            Application.academic_year == academic_year,
            Application.semester == semester,
            Application.status.in_([
                ApplicationStatus.PENDING,
                ApplicationStatus.REVIEWING,
                ApplicationStatus.ENDORSED,
                ApplicationStatus.INTERVIEW,
                ApplicationStatus.ACCEPTED,
            ]),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                "You already have an active application "
                "for this position in the current semester."
            ),
        )

    _validate_document_ownership(
        db,
        application_data.resume_id,
        current_user.id,
        "Resume",
        "resume",
        academic_year,
        semester,
    )

    _validate_document_ownership(
        db,
        application_data.application_letter_id,
        current_user.id,
        "Application letter",
        "application_letter",
        academic_year,
        semester,
    )

    application = Application(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        company_id=company.id,
        academic_year=academic_year,
        semester=semester,
        position=application_data.position.strip(),
        cover_letter=application_data.cover_letter,
        resume_id=application_data.resume_id,
        application_letter_id=application_data.application_letter_id,
        status=ApplicationStatus.PENDING,
    )

    try:
        db.add(application)
        db.commit()
        db.refresh(application)
    except Exception:
        db.rollback()
        raise

    _notify_application_status(
        db,
        application,
        ApplicationStatus.PENDING,
        company.name,
    )

    return _to_response(application, company.name)


# ============================================================
# STUDENT: OWN APPLICATIONS
# ============================================================

@router.get(
    "/",
    response_model=PaginatedResponse[ApplicationResponse],
)
async def get_my_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Student access required",
        )

    query = (
        db.query(Application)
        .filter(Application.student_id == current_user.id)
        .order_by(Application.applied_date.desc())
    )

    items, total = _paginate(query, page, limit)
    companies = _company_name_map(db, items)

    return PaginatedResponse[ApplicationResponse](
        items=[
            _to_response(
                application,
                companies.get(application.company_id),
            )
            for application in items
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit),
    )


# ============================================================
# ADMIN: ALL APPLICATIONS
# ============================================================

@router.get(
    "/all",
    response_model=PaginatedResponse[ApplicationResponse],
)
async def get_all_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = (
        db.query(Application)
        .order_by(Application.applied_date.desc())
    )

    items, total = _paginate(query, page, limit)
    companies = _company_name_map(db, items)

    return PaginatedResponse[ApplicationResponse](
        items=[
            _to_response(
                application,
                companies.get(application.company_id),
            )
            for application in items
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit),
    )


# ============================================================
# HTE: APPLICATIONS FOR ASSIGNED COMPANIES
# ============================================================

@router.get(
    "/hte",
    response_model=PaginatedResponse[ApplicationResponse],
)
async def get_hte_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HTE_SUPERVISOR:
        raise HTTPException(
            status_code=403,
            detail="HTE Supervisor access required",
        )

    academic_year, semester = _current_term()

    company_ids = (
        db.query(HTESupervisorCompany.company_id)
        .filter(
            HTESupervisorCompany.supervisor_id == current_user.id,
            HTESupervisorCompany.is_active.is_(True),
        )
    )

    query = (
        db.query(Application)
        .filter(
            Application.company_id.in_(company_ids),
            Application.academic_year == academic_year,
            Application.semester == semester,
            Application.status.in_([
                ApplicationStatus.ENDORSED,
                ApplicationStatus.INTERVIEW,
                ApplicationStatus.ACCEPTED,
                ApplicationStatus.REJECTED,
            ]),
        )
        .order_by(Application.applied_date.desc())
    )

    items, total = _paginate(query, page, limit)
    companies = _company_name_map(db, items)

    return PaginatedResponse[ApplicationResponse](
        items=[
            _to_response(
                application,
                companies.get(application.company_id),
            )
            for application in items
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit),
    )


# ============================================================
# GET SINGLE APPLICATION
# ============================================================

@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
)
async def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = _get_application(db, application_id)

    if current_user.role == UserRole.COORDINATOR:
        ensure_coordinator_student_access(
            db,
            current_user,
            application.student_id,
            academic_year=application.academic_year,
            semester=application.semester,
            mode="read",
        )

    elif current_user.role == UserRole.HTE_SUPERVISOR:
        _require_hte_company_access(
            db,
            current_user,
            application.company_id,
        )

        if application.status not in (
            ApplicationStatus.ENDORSED,
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.REJECTED,
        ):
            raise HTTPException(
                status_code=403,
                detail="Application has not been endorsed",
            )

    elif (
        current_user.role != UserRole.ADMIN
        and current_user.id != application.student_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return _to_response(
        application,
        _get_company_name(db, application.company_id),
    )


# ============================================================
# COORDINATOR: REVIEW AND ENDORSE
# HTE: INTERVIEW / ACCEPT / REJECT
# ============================================================

@router.put(
    "/{application_id}",
    response_model=ApplicationResponse,
)
async def update_application_status(
    application_id: str,
    update_data: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (
        UserRole.COORDINATOR,
        UserRole.HTE_SUPERVISOR,
    ):
        raise HTTPException(
            status_code=403,
            detail="Coordinator or HTE Supervisor access required",
        )

    updates = update_data.model_dump(exclude_unset=True)

    if set(updates) != {"status"} or updates["status"] is None:
        raise HTTPException(
            status_code=422,
            detail="Only a valid application status may be updated",
        )

    try:
        application = _get_application(
            db,
            application_id,
            lock=True,
        )

        _require_current_application(application)

        requested_status = ApplicationStatus(
            updates["status"]
        )

        if current_user.role == UserRole.COORDINATOR:
            ensure_coordinator_student_access(
                db,
                current_user,
                application.student_id,
                mode="write",
                academic_year=application.academic_year,
                semester=application.semester,
            )

            allowed = {
                ApplicationStatus.PENDING: {
                    ApplicationStatus.REVIEWING,
                    ApplicationStatus.ENDORSED,
                },
                ApplicationStatus.REVIEWING: {
                    ApplicationStatus.ENDORSED,
                },
            }

            if requested_status not in allowed.get(
                application.status, set()
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Invalid Coordinator status transition",
                )

            if requested_status == ApplicationStatus.ENDORSED:
                application.endorsed_by = current_user.id
                application.endorsed_at = datetime.utcnow()

        else:
            _require_hte_company_access(
                db,
                current_user,
                application.company_id,
            )

            allowed = {
                ApplicationStatus.ENDORSED: {
                    ApplicationStatus.INTERVIEW,
                    ApplicationStatus.ACCEPTED,
                    ApplicationStatus.REJECTED,
                },
                ApplicationStatus.INTERVIEW: {
                    ApplicationStatus.ACCEPTED,
                    ApplicationStatus.REJECTED,
                },
            }

            if requested_status not in allowed.get(
                application.status, set()
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Invalid HTE application status transition",
                )

            if requested_status in (ApplicationStatus.INTERVIEW, ApplicationStatus.ACCEPTED):
                direct_service.ensure_application_ready(db, application)
            if requested_status == ApplicationStatus.ACCEPTED:
                direct_service.require_no_direct_conflict(db, application.student_id, application.academic_year, application.semester, application.id)

            if requested_status in (
                ApplicationStatus.ACCEPTED,
                ApplicationStatus.REJECTED,
            ):
                application.decided_by = current_user.id
                application.decided_at = datetime.utcnow()

                if requested_status == ApplicationStatus.ACCEPTED:
                    db.query(User).filter(User.id == application.student_id).with_for_update().one()
                    already_accepted = (
                        db.query(Application)
                        .filter(
                            Application.student_id
                            == application.student_id,
                            Application.academic_year
                            == application.academic_year,
                            Application.semester
                            == application.semester,
                            Application.status
                            == ApplicationStatus.ACCEPTED,
                            Application.id != application.id,
                        )
                        .first()
                    )

                    if already_accepted:
                        raise HTTPException(
                            status_code=409,
                            detail=(
                                "Student already has an accepted "
                                "application for this semester"
                            ),
                        )

        application.status = requested_status
        direct_service.application_changed(db, application, current_user.id)
        application.updated_date = func.now()

        # Create the PRE_DEPLOYMENT record only after HTE acceptance.
        # Both changes are committed in one transaction.
        if requested_status == ApplicationStatus.ACCEPTED:
            db.flush()

            DeploymentService.create_for_accepted_application(
                db=db,
                application=application,
            )

        db.commit()
        db.refresh(application)

    except Exception:
        db.rollback()
        raise

    company_name = _get_company_name(
        db,
        application.company_id,
    )

    _notify_application_status(
        db,
        application,
        application.status,
        company_name,
    )

    return _to_response(application, company_name)


# ============================================================
# STUDENT: WITHDRAW APPLICATION
# ============================================================

@router.post("/{application_id}/withdraw")
async def withdraw_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        application = _get_application(
            db,
            application_id,
            lock=True,
        )

        if application.student_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only withdraw your own applications",
            )

        _require_current_application(application)

        if application.status in (
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
        ):
            raise HTTPException(
                status_code=409,
                detail="Cannot withdraw this application",
            )

        application.status = ApplicationStatus.WITHDRAWN
        direct_service.application_changed(db, application, current_user.id)
        application.updated_date = func.now()

        db.commit()
        db.refresh(application)

    except Exception:
        db.rollback()
        raise

    _notify_application_status(
        db,
        application,
        ApplicationStatus.WITHDRAWN,
        _get_company_name(db, application.company_id),
    )

    return {"message": "Application withdrawn successfully"}


@router.get("/{application_id}/attachments/{kind}")
async def get_application_attachment(application_id: str, kind: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from pathlib import Path
    from fastapi.responses import FileResponse
    from app.core.config import settings
    application = _get_application(db, application_id)
    _require_current_application(application)
    _require_hte_company_access(db, current_user, application.company_id)
    if application.status not in (ApplicationStatus.ENDORSED, ApplicationStatus.INTERVIEW, ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED):
        raise HTTPException(status_code=403, detail="Application has not been endorsed")
    if kind not in ("resume", "application_letter"):
        raise HTTPException(status_code=422, detail="Unknown attachment")
    document = getattr(application, kind)
    if document is None or document.uploaded_by != application.student_id or (document.academic_year, document.semester) != (application.academic_year, application.semester):
        raise HTTPException(status_code=404, detail="Attachment not found")
    root = Path(settings.ASSET_DIR).resolve()
    candidate = (root / document.file_path.replace("\\", "/")).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(candidate, filename=document.original_filename or candidate.name, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
