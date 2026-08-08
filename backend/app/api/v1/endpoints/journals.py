from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.journal import Journal, JournalStatus
from app.schemas.journal import JournalCreate, JournalUpdate, JournalResponse

router = APIRouter()


@router.post("/", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
async def create_journal(
    journal_data: JournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new journal entry"""
    
    # Only students can create journals
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can create journals"
        )
    
    # Check if journal already exists for this week
    existing = db.query(Journal).filter(
        Journal.student_id == current_user.id,
        Journal.week == journal_data.week,
        Journal.status != JournalStatus.REJECTED
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Journal for week {journal_data.week} already exists"
        )
    
    # Create journal
    journal = Journal(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        week=journal_data.week,
        title=journal_data.title,
        summary=journal_data.summary,
        content=journal_data.content,
        status=JournalStatus.DRAFT
    )
    
    db.add(journal)
    db.commit()
    db.refresh(journal)
    
    # Include student name
    response = JournalResponse(
        **journal.__dict__,
        student_name=f"{current_user.first_name} {current_user.last_name}"
    )
    
    return response


@router.get("/", response_model=List[JournalResponse])
async def get_my_journals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current student's journals"""
    
    journals = (
        db.query(Journal)
        .filter(Journal.student_id == current_user.id)
        .order_by(Journal.week.desc())
        .all()
    )
    
    result = []
    for journal in journals:
        student = db.query(User).filter(User.id == journal.student_id).first()
        result.append(
            JournalResponse(
                **journal.__dict__,
                student_name=f"{student.first_name} {student.last_name}" if student else None
            )
        )
    
    return result


@router.get("/all", response_model=List[JournalResponse])
async def get_all_journals(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get all journals (admin only)"""
    
    journals = db.query(Journal).offset(skip).limit(limit).all()
    
    result = []
    for journal in journals:
        student = db.query(User).filter(User.id == journal.student_id).first()
        result.append(
            JournalResponse(
                **journal.__dict__,
                student_name=f"{student.first_name} {student.last_name}" if student else None
            )
        )
    
    return result


# ===== SUMMARY ENDPOINT - MOVED ABOVE /{journal_id} =====
@router.get("/summary")
async def get_journal_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get journal summary for current student"""
    
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can view their journal summary"
        )
    
    journals = db.query(Journal).filter(Journal.student_id == current_user.id).all()
    
    total = len(journals)
    draft = len([j for j in journals if j.status == JournalStatus.DRAFT])
    submitted = len([j for j in journals if j.status == JournalStatus.SUBMITTED])
    approved = len([j for j in journals if j.status == JournalStatus.APPROVED])
    rejected = len([j for j in journals if j.status == JournalStatus.REJECTED])
    
    return {
        "total": total,
        "draft": draft,
        "submitted": submitted,
        "approved": approved,
        "rejected": rejected
    }


@router.get("/{journal_id}", response_model=JournalResponse)
async def get_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get journal by ID"""
    
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found"
        )
    
    # Check permissions
    if current_user.role != UserRole.ADMIN and current_user.id != journal.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    student = db.query(User).filter(User.id == journal.student_id).first()
    
    return JournalResponse(
        **journal.__dict__,
        student_name=f"{student.first_name} {student.last_name}" if student else None
    )


@router.put("/{journal_id}", response_model=JournalResponse)
async def update_journal(
    journal_id: str,
    journal_data: JournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update journal"""
    
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found"
        )
    
    # Check permissions
    if current_user.id != journal.student_id and current_user.role not in [UserRole.COORDINATOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # If status is being changed to submitted, set submitted_date
    if journal_data.status == JournalStatus.SUBMITTED:
        journal.submitted_date = datetime.utcnow()
    
    # If status is being changed to approved/rejected, set approved_date
    if journal_data.status in [JournalStatus.APPROVED, JournalStatus.REJECTED]:
        journal.approved_date = datetime.utcnow()
    
    update_data = journal_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(journal, key, value)
    
    journal.updated_at = func.now()
    
    db.commit()
    db.refresh(journal)
    
    student = db.query(User).filter(User.id == journal.student_id).first()
    
    return JournalResponse(
        **journal.__dict__,
        student_name=f"{student.first_name} {student.last_name}" if student else None
    )


@router.delete("/{journal_id}")
async def delete_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete journal (only if draft)"""
    
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found"
        )
    
    # Only the student who owns the journal can delete it
    if current_user.id != journal.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own journals"
        )
    
    # Only draft journals can be deleted
    if journal.status != JournalStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft journals can be deleted"
        )
    
    db.delete(journal)
    db.commit()
    
    return {"message": "Journal deleted successfully"}