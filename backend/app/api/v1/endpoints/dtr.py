# backend/app/api/v1/endpoints/dtr.py
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
import uuid
import os
import shutil
import math
from datetime import datetime, time

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.dtr import DTR, DTRStatus
from app.schemas.dtr import DTRResponse, DTRUpdate
from app.schemas.pagination import PaginatedResponse

router = APIRouter()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def save_upload_file(upload_file: UploadFile, folder: str) -> str:
    """Persist an uploaded file to `folder` and return its relative path."""
    os.makedirs(folder, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(upload_file.filename)[1]
    file_name = f"{file_id}{file_extension}"
    file_path = os.path.join(folder, file_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return os.path.join("dtr_uploads", file_name)


def _student_name(user: User | None) -> Optional[str]:
    if not user:
        return None
    return f"{user.first_name} {user.last_name}"


def _to_response(entry: DTR, student_name: Optional[str]) -> DTRResponse:
    """
    Build a DTRResponse from an ORM object without leaking SQLAlchemy internals
    into pydantic's `__dict__` view.
    """
    return DTRResponse.model_validate(entry).model_copy(
        update={"student_name": student_name}
    )


def _student_name_map(db: Session, entries: List[DTR]) -> dict[str, str]:
    """Batch-fetch student names for a list of DTR entries (avoids N+1)."""
    ids = {e.student_id for e in entries if e.student_id}
    if not ids:
        return {}
    rows = (
        db.query(User.id, User.first_name, User.last_name)
        .filter(User.id.in_(ids))
        .all()
    )
    return {sid: f"{fn} {ln}" for sid, fn, ln in rows}


# ------------------------------------------------------------------
# Create DTR (Time-In)
# ------------------------------------------------------------------

@router.post("/", response_model=DTRResponse, status_code=status.HTTP_201_CREATED)
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
    """Submit a new DTR entry with images (Time-In)."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit DTR",
        )

    # Parse date/time strings
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d").date()
        time_in_obj = datetime.strptime(time_in, "%H:%M:%S").time()
        time_out_obj = (
            datetime.strptime(time_out, "%H:%M:%S").time() if time_out else None
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date or time format: {str(e)}",
        )

    if time_out_obj and time_in_obj >= time_out_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Time in must be before time out",
        )

    # Prevent duplicate entries for the same day
    existing = (
        db.query(DTR)
        .filter(DTR.student_id == current_user.id, DTR.date == date_obj)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTR already submitted for this date",
        )

    # Save images
    upload_folder = os.path.join(settings.ASSET_DIR, "dtr_uploads")
    image_in_path = save_upload_file(image_in, upload_folder)
    image_out_path = save_upload_file(image_out, upload_folder) if image_out else None

    # Compute total hours if time_out given
    total_hours: Optional[float] = None
    dtr_status = DTRStatus.PENDING
    submitted_date = None
    if time_out_obj:
        dt_in = datetime.combine(date_obj, time_in_obj)
        dt_out = datetime.combine(date_obj, time_out_obj)
        total_seconds = (dt_out - dt_in).total_seconds()
        total_hours = round(total_seconds / 3600, 2)
        dtr_status = DTRStatus.SUBMITTED
        submitted_date = datetime.utcnow()

    dtr = DTR(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
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

    return _to_response(dtr, _student_name(current_user))


# ------------------------------------------------------------------
# Student: own DTR list (PAGINATED)
# MUST be declared before /{dtr_id}
# ------------------------------------------------------------------

@router.get("/", response_model=PaginatedResponse[DTRResponse])
async def get_my_dtr(
    page: int = Query(1, ge=1, description="1-based page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current student's DTR entries (paginated)."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their DTR entries",
        )

    query = (
        db.query(DTR)
        .filter(DTR.student_id == current_user.id)
        .order_by(DTR.date.desc())
    )
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    student_name = _student_name(current_user)
    return PaginatedResponse[DTRResponse](
        items=[_to_response(e, student_name) for e in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if limit else 0,
    )


# ------------------------------------------------------------------
# Record Time-Out (PENDING → SUBMITTED)
# ------------------------------------------------------------------

@router.post("/{dtr_id}/time-out", response_model=DTRResponse)
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
    """Record Time-Out for an existing PENDING DTR entry."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can record time-out",
        )

    dtr = db.query(DTR).filter(DTR.id == dtr_id).first()
    if not dtr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DTR entry not found",
        )
    if dtr.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    if dtr.status != DTRStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTR is not in PENDING status, cannot record time-out",
        )

    try:
        time_out_obj = datetime.strptime(time_out, "%H:%M:%S").time()
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

    upload_folder = os.path.join(settings.ASSET_DIR, "dtr_uploads")
    image_out_path = save_upload_file(image_out, upload_folder)

    dt_in = datetime.combine(dtr.date, dtr.time_in)
    dt_out = datetime.combine(dtr.date, time_out_obj)
    total_seconds = (dt_out - dt_in).total_seconds()
    total_hours = round(total_seconds / 3600, 2)

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

    student = db.query(User).filter(User.id == dtr.student_id).first()
    return _to_response(dtr, _student_name(student))


# ------------------------------------------------------------------
# Admin: all DTR (PAGINATED)
# MUST be declared before /{dtr_id}
# ------------------------------------------------------------------

@router.get("/all", response_model=PaginatedResponse[DTRResponse])
async def get_all_dtr(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Get all DTR entries (admin only, paginated)."""
    query = db.query(DTR).order_by(DTR.date.desc())
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    names = _student_name_map(db, items)

    return PaginatedResponse[DTRResponse](
        items=[_to_response(e, names.get(e.student_id)) for e in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if limit else 0,
    )


# ------------------------------------------------------------------
# Summary (single aggregate query)
# MUST be declared before /{dtr_id}
# ------------------------------------------------------------------

@router.get("/summary")
async def get_dtr_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get DTR summary for current student."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their DTR summary",
        )

    row = (
        db.query(
            func.count(DTR.id).label("total_entries"),
            func.sum(case((DTR.status == DTRStatus.PENDING, 1), else_=0)).label("pending"),
            func.sum(case((DTR.status == DTRStatus.SUBMITTED, 1), else_=0)).label("submitted"),
            func.sum(case((DTR.status == DTRStatus.APPROVED, 1), else_=0)).label("approved"),
            func.sum(case((DTR.status == DTRStatus.REJECTED, 1), else_=0)).label("rejected"),
            func.coalesce(
                func.sum(
                    case(
                        (DTR.status == DTRStatus.APPROVED, DTR.total_hours),
                        else_=0,
                    )
                ),
                0,
            ).label("total_hours"),
        )
        .filter(DTR.student_id == current_user.id)
        .one()
    )

    return {
        "total_entries": int(row.total_entries or 0),
        "pending": int(row.pending or 0),
        "submitted": int(row.submitted or 0),
        "approved": int(row.approved or 0),
        "rejected": int(row.rejected or 0),
        "total_hours": round(float(row.total_hours or 0), 2),
    }


# ------------------------------------------------------------------
# Single entry
# ------------------------------------------------------------------

@router.get("/{dtr_id}", response_model=DTRResponse)
async def get_dtr(
    dtr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get DTR entry by ID."""
    dtr = db.query(DTR).filter(DTR.id == dtr_id).first()
    if not dtr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DTR entry not found",
        )

    if current_user.role != UserRole.ADMIN and current_user.id != dtr.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    student = db.query(User).filter(User.id == dtr.student_id).first()
    return _to_response(dtr, _student_name(student))


# ------------------------------------------------------------------
# Update status (coordinator/admin only)
# ------------------------------------------------------------------

@router.put("/{dtr_id}", response_model=DTRResponse)
async def update_dtr_status(
    dtr_id: str,
    update_data: DTRUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update DTR status (coordinator/admin only)."""
    if current_user.role not in [UserRole.COORDINATOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators and admins can update DTR status",
        )

    dtr = db.query(DTR).filter(DTR.id == dtr_id).first()
    if not dtr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DTR entry not found",
        )

    update_data_dict = update_data.model_dump(exclude_unset=True)

    if "status" in update_data_dict:
        if update_data_dict["status"] in [DTRStatus.APPROVED, DTRStatus.REJECTED]:
            dtr.approved_date = datetime.utcnow()

    for key, value in update_data_dict.items():
        setattr(dtr, key, value)

    dtr.updated_at = func.now()

    db.commit()
    db.refresh(dtr)

    student = db.query(User).filter(User.id == dtr.student_id).first()
    return _to_response(dtr, _student_name(student))