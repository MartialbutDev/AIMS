from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import uuid
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.dtr import DTR, DTRStatus
from app.schemas.dtr import DTRCreate, DTRUpdate, DTRResponse

router = APIRouter()


@router.post("/", response_model=DTRResponse, status_code=status.HTTP_201_CREATED)
async def create_dtr(
    dtr_data: DTRCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a new DTR entry"""
    
    # Only students can submit DTR
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit DTR"
        )
    
    # Validate time_in is before time_out
    if dtr_data.time_in >= dtr_data.time_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Time in must be before time out"
        )
    
    # Check if DTR already exists for this date
    existing = db.query(DTR).filter(
        DTR.student_id == current_user.id,
        DTR.date == dtr_data.date
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTR already submitted for this date"
        )
    
    # Calculate total hours
    time_in = datetime.combine(dtr_data.date, dtr_data.time_in)
    time_out = datetime.combine(dtr_data.date, dtr_data.time_out)
    total_seconds = (time_out - time_in).total_seconds()
    total_hours = round(total_seconds / 3600, 2)
    
    # Create DTR entry
    dtr = DTR(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        date=dtr_data.date,
        time_in=dtr_data.time_in,
        time_out=dtr_data.time_out,
        total_hours=total_hours,
        tasks_completed=dtr_data.tasks_completed,
        notes=dtr_data.notes,
        latitude=dtr_data.latitude,
        longitude=dtr_data.longitude,
        location_address=dtr_data.location_address,
        status=DTRStatus.PENDING,
        submitted_date=datetime.utcnow()
    )
    
    db.add(dtr)
    db.commit()
    db.refresh(dtr)
    
    # Include student name in response
    response = DTRResponse(
        **dtr.__dict__,
        student_name=f"{current_user.first_name} {current_user.last_name}"
    )
    
    return response


@router.get("/", response_model=List[DTRResponse])
async def get_my_dtr(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current student's DTR entries"""
    
    dtr_entries = (
        db.query(DTR)
        .filter(DTR.student_id == current_user.id)
        .order_by(DTR.date.desc())
        .all()
    )
    
    # Include student names
    result = []
    for entry in dtr_entries:
        student = db.query(User).filter(User.id == entry.student_id).first()
        result.append(
            DTRResponse(
                **entry.__dict__,
                student_name=f"{student.first_name} {student.last_name}" if student else None
            )
        )
    
    return result


@router.get("/all", response_model=List[DTRResponse])
async def get_all_dtr(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get all DTR entries (admin only)"""
    
    dtr_entries = db.query(DTR).offset(skip).limit(limit).all()
    
    result = []
    for entry in dtr_entries:
        student = db.query(User).filter(User.id == entry.student_id).first()
        result.append(
            DTRResponse(
                **entry.__dict__,
                student_name=f"{student.first_name} {student.last_name}" if student else None
            )
        )
    
    return result


# ===== SUMMARY ENDPOINT - MOVED ABOVE /{dtr_id} =====
@router.get("/summary")
async def get_dtr_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get DTR summary for current student"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their DTR summary"
        )
    
    # Get all DTR entries for current student
    entries = db.query(DTR).filter(DTR.student_id == current_user.id).all()
    
    total_entries = len(entries)
    pending = len([e for e in entries if e.status == DTRStatus.PENDING])
    submitted = len([e for e in entries if e.status == DTRStatus.SUBMITTED])
    approved = len([e for e in entries if e.status == DTRStatus.APPROVED])
    rejected = len([e for e in entries if e.status == DTRStatus.REJECTED])
    
    total_hours = sum([e.total_hours or 0 for e in entries if e.status == DTRStatus.APPROVED])
    
    return {
        "total_entries": total_entries,
        "pending": pending,
        "submitted": submitted,
        "approved": approved,
        "rejected": rejected,
        "total_hours": round(total_hours, 2)
    }


@router.get("/{dtr_id}", response_model=DTRResponse)
async def get_dtr(
    dtr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get DTR entry by ID"""
    
    dtr = db.query(DTR).filter(DTR.id == dtr_id).first()
    if not dtr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DTR entry not found"
        )
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and current_user.id != dtr.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    student = db.query(User).filter(User.id == dtr.student_id).first()
    
    return DTRResponse(
        **dtr.__dict__,
        student_name=f"{student.first_name} {student.last_name}" if student else None
    )


@router.put("/{dtr_id}", response_model=DTRResponse)
async def update_dtr_status(
    dtr_id: str,
    update_data: DTRUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update DTR status (coordinator/admin only)"""
    
    if current_user.role not in [UserRole.COORDINATOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coordinators and admins can update DTR status"
        )
    
    dtr = db.query(DTR).filter(DTR.id == dtr_id).first()
    if not dtr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DTR entry not found"
        )
    
    update_data_dict = update_data.model_dump(exclude_unset=True)
    
    # If status is changing to approved or rejected, set approved_date
    if "status" in update_data_dict:
        if update_data_dict["status"] in [DTRStatus.APPROVED, DTRStatus.REJECTED]:
            dtr.approved_date = datetime.utcnow()
    
    for key, value in update_data_dict.items():
        setattr(dtr, key, value)
    
    dtr.updated_at = func.now()
    
    db.commit()
    db.refresh(dtr)
    
    student = db.query(User).filter(User.id == dtr.student_id).first()
    
    return DTRResponse(
        **dtr.__dict__,
        student_name=f"{student.first_name} {student.last_name}" if student else None
    )