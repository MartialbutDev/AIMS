
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    File,
    UploadFile,
    Form,
    Query,
)

from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
from datetime import datetime

import uuid
import os
import shutil
import math

from app.core.config import settings
from app.core.database import get_db
from app.core.assignment_access import (
    ensure_coordinator_student_access,
    get_current_academic_term,
)
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.dtr import DTR, DTRStatus
from app.schemas.dtr import DTRResponse, DTRUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.notification_service import NotificationService
from app.services.deployment_service import DeploymentService

router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def save_upload_file(
    upload_file: UploadFile,
    folder: str,
) -> str:
    os.makedirs(
        folder,
        exist_ok=True,
    )

    file_id = str(uuid.uuid4())

    file_extension = os.path.splitext(
        upload_file.filename or ""
    )[1]

    file_name = f"{file_id}{file_extension}"

    file_path = os.path.join(
        folder,
        file_name,
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            upload_file.file,
            buffer,
        )

    return os.path.join(
        "dtr_uploads",
        file_name,
    )


def _student_name(
    user: User | None,
) -> Optional[str]:
    if not user:
        return None

    return (
        f"{user.first_name} "
        f"{user.last_name}"
    )


def _to_response(
    entry: DTR,
    student_name: Optional[str],
) -> DTRResponse:
    return DTRResponse.model_validate(
        entry
    ).model_copy(
        update={
            "student_name": student_name
        }
    )


def _student_name_map(
    db: Session,
    entries: List[DTR],
) -> dict[str, str]:
    ids = {
        entry.student_id
        for entry in entries
        if entry.student_id
    }

    if not ids:
        return {}

    rows = (
        db.query(
            User.id,
            User.first_name,
            User.last_name,
        )
        .filter(
            User.id.in_(ids)
        )
        .all()
    )

    return {
        student_id: f"{first_name} {last_name}"
        for student_id, first_name, last_name in rows
    }


def _fire_dtr_notification(
    db: Session,
    dtr: DTR,
    status_value: str,
) -> None:
    try:
        date_str = (
            dtr.date.strftime("%b %d, %Y")
            if dtr.date
            else "Unknown date"
        )

        NotificationService.create_dtr_notification(
            db=db,
            user_id=dtr.student_id,
            dtr_id=dtr.id,
            status=status_value,
            date=date_str,
        )

    except Exception as exc:
        print(
            f"Failed to create DTR notification: {exc}"
        )


def _require_current_record_term(entry: DTR) -> None:
    """Fail closed for historical or unclassified DTR modifications."""
    year, semester = get_current_academic_term()
    if not entry.academic_year or not entry.semester:
        raise HTTPException(
            status_code=409,
            detail="DTR academic term is unverified; historical reconciliation required",
        )
    if (entry.academic_year, entry.semester) != (year, semester):
        raise HTTPException(
            status_code=403,
            detail="Historical DTR records are read-only",
        )


def _require_coordinator_record_access(
    db: Session,
    actor: User,
    entry: DTR,
    *,
    mode: str = "read",
) -> None:
    """Authorize against the DTR's actual term, never a caller-supplied term."""
    if not entry.academic_year or not entry.semester:
        raise HTTPException(
            status_code=409,
            detail="DTR academic term is unverified; historical reconciliation required",
        )
    ensure_coordinator_student_access(
        db,
        actor,
        entry.student_id,
        mode=mode,
        academic_year=entry.academic_year,
        semester=entry.semester,
    )


# ============================================================
# STUDENT: CREATE DTR / TIME-IN
# ============================================================

@router.post(
    "/",
    response_model=DTRResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dtr(
    date: str = Form(...),
    time_in: str = Form(...),
    time_out: Optional[str] = Form(None),
    tasks_completed: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_address: Optional[str] = Form(None),
    image_in: UploadFile = File(...),
    image_out: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit DTR",
        )

    academic_year, semester = get_current_academic_term()
    deployment = DeploymentService.require_active_deployment(db, current_user.id)

    try:
        date_obj = datetime.strptime(
            date,
            "%Y-%m-%d",
        ).date()

        time_in_obj = datetime.strptime(
            time_in,
            "%H:%M:%S",
        ).time()

        time_out_obj = (
            datetime.strptime(
                time_out,
                "%H:%M:%S",
            ).time()
            if time_out
            else None
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date or time format: {exc}",
        )

    if (
        time_out_obj
        and time_in_obj >= time_out_obj
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Time in must be before time out",
        )

    if date_obj < deployment.deployment_date:
        raise HTTPException(status_code=403, detail="DTR date precedes official deployment")

    existing = (
        db.query(DTR)
        .filter(
            DTR.student_id == current_user.id,
            DTR.date == date_obj,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTR already submitted for this date",
        )

    upload_folder = os.path.join(
        settings.ASSET_DIR,
        "dtr_uploads",
    )

    image_in_path = save_upload_file(
        image_in,
        upload_folder,
    )

    image_out_path = (
        save_upload_file(
            image_out,
            upload_folder,
        )
        if image_out
        else None
    )

    total_hours: Optional[float] = None
    dtr_status = DTRStatus.PENDING
    submitted_date = None

    if time_out_obj:
        dt_in = datetime.combine(
            date_obj,
            time_in_obj,
        )

        dt_out = datetime.combine(
            date_obj,
            time_out_obj,
        )

        total_seconds = (
            dt_out - dt_in
        ).total_seconds()

        total_hours = round(
            total_seconds / 3600,
            2,
        )

        dtr_status = DTRStatus.SUBMITTED
        submitted_date = datetime.utcnow()

    dtr = DTR(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        academic_year=academic_year,
        semester=semester,
        date=date_obj,
        time_in=time_in_obj,
        time_out=time_out_obj,
        total_hours=total_hours,
        tasks_completed=tasks_completed,
        notes=notes,
        latitude=latitude,
        longitude=longitude,
        location_address=location_address,
        image_in_path=image_in_path,
        image_out_path=image_out_path,
        status=dtr_status,
        submitted_date=submitted_date,
    )

    db.add(dtr)
    db.commit()
    db.refresh(dtr)

    _fire_dtr_notification(
        db,
        dtr,
        dtr_status.value,
    )

    return _to_response(
        dtr,
        _student_name(current_user),
    )


# ============================================================
# STUDENT: OWN DTR RECORDS
# ============================================================

@router.get(
    "/",
    response_model=PaginatedResponse[DTRResponse],
)
async def get_my_dtr(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only students can view "
                "their DTR entries"
            ),
        )

    academic_year, semester = get_current_academic_term()

    query = (
        db.query(DTR)
        .filter(
            DTR.student_id == current_user.id,
            DTR.academic_year == academic_year,
            DTR.semester == semester,
        )
        .order_by(
            DTR.date.desc()
        )
    )

    total = query.count()

    items = (
        query.offset(
            (page - 1) * limit
        )
        .limit(limit)
        .all()
    )

    student_name = _student_name(current_user)

    return PaginatedResponse[DTRResponse](
        items=[
            _to_response(
                entry,
                student_name,
            )
            for entry in items
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit),
    )


# ============================================================
# STUDENT: RECORD TIME-OUT
# ============================================================

@router.post(
    "/{dtr_id}/time-out",
    response_model=DTRResponse,
)
async def record_time_out(
    dtr_id: str,
    time_out: str = Form(...),
    image_out: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_address: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can record time-out",
        )

    dtr = (
        db.query(DTR)
        .filter(
            DTR.id == dtr_id
        )
        .first()
    )

    if not dtr:
        raise HTTPException(
            status_code=404,
            detail="DTR entry not found",
        )

    if dtr.student_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    _require_current_record_term(dtr)
    deployment = DeploymentService.require_active_deployment(db, current_user.id)
    # DTR.date is DateTime; deployment_date is Date. Compare calendar dates.
    if dtr.date.date() < deployment.deployment_date:
        raise HTTPException(status_code=403, detail="DTR date precedes official deployment")

    if dtr.status != DTRStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "DTR is not in PENDING status, "
                "cannot record time-out"
            ),
        )

    try:
        time_out_obj = datetime.strptime(
            time_out,
            "%H:%M:%S",
        ).time()

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid time format",
        )

    if dtr.time_in >= time_out_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Time in must be before time out",
        )

    upload_folder = os.path.join(
        settings.ASSET_DIR,
        "dtr_uploads",
    )

    image_out_path = save_upload_file(
        image_out,
        upload_folder,
    )

    dt_in = datetime.combine(
        dtr.date,
        dtr.time_in,
    )

    dt_out = datetime.combine(
        dtr.date,
        time_out_obj,
    )

    total_seconds = (
        dt_out - dt_in
    ).total_seconds()

    total_hours = round(
        total_seconds / 3600,
        2,
    )

    dtr.time_out = time_out_obj
    dtr.image_out_path = image_out_path
    dtr.latitude = latitude
    dtr.longitude = longitude
    dtr.location_address = location_address
    dtr.total_hours = total_hours
    dtr.status = DTRStatus.SUBMITTED
    dtr.submitted_date = datetime.utcnow()
    dtr.updated_at = func.now()

    db.commit()
    db.refresh(dtr)

    student = (
        db.query(User)
        .filter(
            User.id == dtr.student_id
        )
        .first()
    )

    _fire_dtr_notification(
        db,
        dtr,
        dtr.status.value,
    )

    return _to_response(
        dtr,
        _student_name(student),
    )


# ============================================================
# ADMIN: ALL DTR RECORDS
# ============================================================

@router.get(
    "/all",
    response_model=PaginatedResponse[DTRResponse],
)
async def get_all_dtr(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin")
    ),
):
    query = (
        db.query(DTR)
        .order_by(
            DTR.date.desc()
        )
    )

    total = query.count()

    items = (
        query.offset(
            (page - 1) * limit
        )
        .limit(limit)
        .all()
    )

    names = _student_name_map(
        db,
        items,
    )

    return PaginatedResponse[DTRResponse](
        items=[
            _to_response(
                entry,
                names.get(entry.student_id),
            )
            for entry in items
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit),
    )


# ============================================================
# STUDENT: DTR SUMMARY
# ============================================================

@router.get("/summary")
async def get_dtr_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only students can view "
                "their DTR summary"
            ),
        )

    academic_year, semester = get_current_academic_term()

    row = (
        db.query(
            func.count(DTR.id).label(
                "total_entries"
            ),
            func.sum(
                case(
                    (
                        DTR.status == DTRStatus.PENDING,
                        1,
                    ),
                    else_=0,
                )
            ).label("pending"),
            func.sum(
                case(
                    (
                        DTR.status == DTRStatus.SUBMITTED,
                        1,
                    ),
                    else_=0,
                )
            ).label("submitted"),
            func.sum(
                case(
                    (
                        DTR.status == DTRStatus.APPROVED,
                        1,
                    ),
                    else_=0,
                )
            ).label("approved"),
            func.sum(
                case(
                    (
                        DTR.status == DTRStatus.REJECTED,
                        1,
                    ),
                    else_=0,
                )
            ).label("rejected"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            DTR.status == DTRStatus.APPROVED,
                            DTR.total_hours,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("total_hours"),
        )
        .filter(
            DTR.student_id == current_user.id,
            DTR.academic_year == academic_year,
            DTR.semester == semester,
        )
        .one()
    )

    from app.models.application import (
        Application,
        ApplicationStatus,
    )
    from app.models.company import Company

    accepted_app = (
        db.query(Application)
        .filter(
            Application.student_id == current_user.id,
            Application.academic_year == academic_year,
            Application.semester == semester,
            Application.status == ApplicationStatus.ACCEPTED,
        )
        .order_by(
            Application.updated_date.desc()
        )
        .first()
    )

    current_company = None

    if accepted_app:
        company = (
            db.query(Company)
            .filter(
                Company.id == accepted_app.company_id
            )
            .first()
        )

        current_company = (
            company.name
            if company
            else None
        )

    required_hours = settings.REQUIRED_INTERNSHIP_HOURS

    from app.services.reporting_scope import approved_hours
    total_hours = approved_hours(db,{current_user.id},academic_year,semester)[current_user.id]

    remaining_hours = max(
        0,
        round(
            required_hours - total_hours,
            2,
        ),
    )

    progress_pct = (
        min(
            100,
            int(
                total_hours / required_hours * 100
            ),
        )
        if required_hours > 0
        else 0
    )

    return {
        "total_entries": int(
            row.total_entries or 0
        ),
        "pending": int(
            row.pending or 0
        ),
        "submitted": int(
            row.submitted or 0
        ),
        "approved": int(
            row.approved or 0
        ),
        "rejected": int(
            row.rejected or 0
        ),
        "total_hours": total_hours,
        "academic_year": academic_year, "semester": semester,
        "required_hours": required_hours,
        "remaining_hours": remaining_hours,
        "progress_percent": progress_pct,
        "current_company": current_company,
    }


# ============================================================
# GET SINGLE DTR
# ============================================================

@router.get(
    "/{dtr_id}",
    response_model=DTRResponse,
)
async def get_dtr(
    dtr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dtr = (
        db.query(DTR)
        .filter(
            DTR.id == dtr_id
        )
        .first()
    )

    if not dtr:
        raise HTTPException(
            status_code=404,
            detail="DTR entry not found",
        )

    if current_user.role == UserRole.COORDINATOR:
        _require_coordinator_record_access(
            db,
            current_user,
            dtr,
            mode="read",
        )

    elif (
        current_user.role != UserRole.ADMIN
        and current_user.id != dtr.student_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    student = (
        db.query(User)
        .filter(
            User.id == dtr.student_id
        )
        .first()
    )

    return _to_response(
        dtr,
        _student_name(student),
    )


# ============================================================
# COORDINATOR / ADMIN: REVIEW DTR
# ============================================================

@router.put(
    "/{dtr_id}",
    response_model=DTRResponse,
)
async def update_dtr_status(
    dtr_id: str,
    update_data: DTRUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [
        UserRole.COORDINATOR,
        UserRole.ADMIN,
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only coordinators and admins "
                "can update DTR status"
            ),
        )

    dtr = (
        db.query(DTR)
        .filter(
            DTR.id == dtr_id
        )
        .first()
    )

    if not dtr:
        raise HTTPException(
            status_code=404,
            detail="DTR entry not found",
        )

    _require_current_record_term(dtr)

    updates = update_data.model_dump(
        exclude_unset=True
    )

    if current_user.role == UserRole.COORDINATOR:
        _require_coordinator_record_access(
            db,
            current_user,
            dtr,
            mode="write",
        )

        if set(updates) != {"status"}:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Coordinators may only review "
                    "DTR status"
                ),
            )

        if (
            dtr.status != DTRStatus.SUBMITTED
            or dtr.time_out is None
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only completed, submitted "
                    "DTRs may be reviewed"
                ),
            )

        if updates["status"] not in (
            DTRStatus.APPROVED,
            DTRStatus.REJECTED,
        ):
            raise HTTPException(
                status_code=422,
                detail="Invalid coordinator DTR status",
            )

    old_status = dtr.status

    if "status" in updates:
        if updates["status"] in [
            DTRStatus.APPROVED,
            DTRStatus.REJECTED,
        ]:
            dtr.approved_date = datetime.utcnow()

    for key, value in updates.items():
        setattr(
            dtr,
            key,
            value,
        )

    dtr.updated_at = func.now()

    db.commit()
    db.refresh(dtr)

    student = (
        db.query(User)
        .filter(
            User.id == dtr.student_id
        )
        .first()
    )

    if old_status != dtr.status:
        _fire_dtr_notification(
            db,
            dtr,
            dtr.status.value,
        )

    return _to_response(
        dtr,
        _student_name(student),
    )


@router.get("/{dtr_id}/photo/{photo_type}")
async def get_student_dtr_photo(
    dtr_id: str,
    photo_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from pathlib import Path
    from fastapi.responses import FileResponse
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Student access required")
    entry = db.query(DTR).filter(DTR.id == dtr_id, DTR.student_id == current_user.id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="DTR entry not found")
    if photo_type not in ("in", "out"):
        raise HTTPException(status_code=422, detail="Choose an in or out photo")
    relative = entry.image_in_path if photo_type == "in" else entry.image_out_path
    if not relative:
        raise HTTPException(status_code=404, detail="Photo not uploaded")
    root = (Path(settings.ASSET_DIR) / "dtr_uploads").resolve()
    candidate = (Path(settings.ASSET_DIR) / relative.replace("\\", "/")).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(candidate, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
