# backend/app/api/v1/endpoints/users.py
import csv
import io
import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import os
import shutil
from datetime import datetime
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, require_role
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.user import User, UserRole
from app.schemas.user import (
    AdminUserCreate,
    UserImportResponse,
    UserResponse,
    UserUpdate,
)
from app.core.config import settings

router = APIRouter()

MAX_CSV_BYTES = 2 * 1024 * 1024
MAX_CSV_ROWS = 500
CSV_REQUIRED_COLUMNS = {"email", "first_name", "last_name", "role", "password"}


class CoordinatorAssignmentInput(BaseModel):
    coordinator_id: str = Field(min_length=1, max_length=36)
    student_id: str = Field(min_length=1, max_length=36)


def _create_managed_user(user_data: AdminUserCreate) -> User:
    return User(
        id=str(uuid.uuid4()),
        email=str(user_data.email),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        role=UserRole(user_data.role.value),
        is_active=True,
        is_verified=True,
    )


def _parse_managed_user_csv(content: bytes) -> List[AdminUserCreate]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must be UTF-8 encoded.",
        ) from exc

    reader = csv.DictReader(io.StringIO(text, newline=""))
    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must include a header row.",
        )

    headers = {header.strip().lower() for header in reader.fieldnames if header}
    missing_columns = sorted(CSV_REQUIRED_COLUMNS - headers)
    if missing_columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required CSV columns: {', '.join(missing_columns)}",
        )

    users = []
    errors = []
    seen_emails = set()
    for row_number, raw_row in enumerate(reader, start=2):
        if row_number > MAX_CSV_ROWS + 1:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"CSV cannot contain more than {MAX_CSV_ROWS} users.",
            )
        if None in raw_row:
            errors.append(f"Row {row_number}: contains more values than the header.")
            continue

        row = {
            (key or "").strip().lower(): (value or "").strip()
            for key, value in raw_row.items()
        }
        if not any(row.values()):
            continue

        if row.get("role", "").lower() == "company":
            row["role"] = UserRole.HTE_SUPERVISOR.value

        try:
            user_data = AdminUserCreate.model_validate(row)
        except ValidationError as exc:
            messages = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors()
            )
            errors.append(f"Row {row_number}: {messages}")
            continue

        normalized_email = str(user_data.email).lower()
        if normalized_email in seen_emails:
            errors.append(f"Row {row_number}: duplicate email in CSV.")
            continue
        seen_emails.add(normalized_email)
        users.append(user_data)

    if not users and not errors:
        errors.append("CSV contains no user rows.")
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=errors,
        )
    return users


@router.post(
    "/managed",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_managed_user(
    user_data: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a non-student account. The role is assigned by an administrator."""
    existing_user = db.query(User).filter(
        func.lower(User.email) == str(user_data.email).lower()
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )

    user = _create_managed_user(user_data)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        ) from exc
    db.refresh(user)
    return user


@router.post(
    "/import-csv",
    response_model=UserImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_managed_users_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Import non-student accounts atomically from an administrator-uploaded CSV."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a .csv file.",
        )

    content = await file.read(MAX_CSV_BYTES + 1)
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="CSV file cannot exceed 2 MB.",
        )

    user_data_rows = _parse_managed_user_csv(content)
    emails = [str(user_data.email).lower() for user_data in user_data_rows]
    existing_emails = {
        email.lower()
        for (email,) in db.query(User.email).filter(func.lower(User.email).in_(emails)).all()
    }
    duplicates = sorted(existing_emails)
    if duplicates:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email already registered: {', '.join(duplicates)}",
        )

    users = [_create_managed_user(user_data) for user_data in user_data_rows]
    db.add_all(users)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more email addresses are already registered.",
        ) from exc
    for user in users:
        db.refresh(user)
    return UserImportResponse(created_count=len(users), users=users)


@router.get("/", response_model=List[UserResponse])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Get all users.
    Admin only.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/coordinator-assignments")
async def get_coordinator_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Return coordinators and available students for admin assignment management."""
    coordinators = db.query(User).filter(
        User.role == UserRole.COORDINATOR,
        User.is_active.is_(True),
    ).order_by(User.last_name, User.first_name).all()
    students = db.query(User).filter(
        User.role == UserRole.STUDENT,
        User.is_active.is_(True),
    ).order_by(User.last_name, User.first_name).all()
    assignments = db.query(CoordinatorStudentAssignment, User).join(
        User,
        User.id == CoordinatorStudentAssignment.student_id,
    ).filter(User.role == UserRole.STUDENT).all()

    assignments_by_coordinator: dict[str, list[dict[str, str | None]]] = {}
    assigned_student_ids = set()
    for assignment, student in assignments:
        assigned_student_ids.add(student.id)
        assignments_by_coordinator.setdefault(assignment.coordinator_id, []).append({
            "id": student.id,
            "student_id": student.student_id,
            "name": f"{student.first_name} {student.last_name}".strip(),
        })

    return {
        "coordinators": [
            {
                "id": coordinator.id,
                "name": f"{coordinator.first_name} {coordinator.last_name}".strip(),
                "students": assignments_by_coordinator.get(coordinator.id, []),
            }
            for coordinator in coordinators
        ],
        "unassigned_students": [
            {
                "id": student.id,
                "student_id": student.student_id,
                "name": f"{student.first_name} {student.last_name}".strip(),
            }
            for student in students
            if student.id not in assigned_student_ids
        ],
    }


@router.post("/coordinator-assignments", status_code=status.HTTP_201_CREATED)
async def create_coordinator_assignment(
    assignment_data: CoordinatorAssignmentInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    coordinator = db.query(User).filter(
        User.id == assignment_data.coordinator_id,
        User.role == UserRole.COORDINATOR,
        User.is_active.is_(True),
    ).first()
    if coordinator is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active coordinator not found")

    student = db.query(User).filter(
        User.id == assignment_data.student_id,
        User.role == UserRole.STUDENT,
        User.is_active.is_(True),
    ).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active student not found")

    existing_assignment = db.query(CoordinatorStudentAssignment).filter(
        CoordinatorStudentAssignment.student_id == student.id,
    ).first()
    if existing_assignment:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student is already assigned to a coordinator")

    assignment = CoordinatorStudentAssignment(
        coordinator_id=coordinator.id,
        student_id=student.id,
    )
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student is already assigned to a coordinator") from exc

    return {"coordinator_id": coordinator.id, "student_id": student.id}


@router.delete("/coordinator-assignments/{coordinator_id}/{student_id}")
async def delete_coordinator_assignment(
    coordinator_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    assignment = db.query(CoordinatorStudentAssignment).filter(
        CoordinatorStudentAssignment.coordinator_id == coordinator_id,
        CoordinatorStudentAssignment.student_id == student_id,
    ).first()
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coordinator assignment not found")
    db.delete(assignment)
    db.commit()
    return {"message": "Student assignment removed"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user by ID.
    Users can view their own profile.
    Admins can view anyone.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Update user.
    Admin only.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    update_data = user_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Delete user.
    Admin only.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


# ✅ Upload Avatar - Any authenticated user
@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload user avatar image - Any authenticated user"""
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/heic"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file to check size
    content = await file.read()
    file_size = len(content)
    await file.seek(0)
    
    # Validate file size (max 5MB)
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size: 5MB"
        )
    
    try:
        # Create avatar directory
        avatar_dir = os.path.join(settings.ASSET_DIR, "avatars")
        os.makedirs(avatar_dir, exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1].lower()
        filename = f"avatar_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{file_extension}"
        file_path = os.path.join(avatar_dir, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Delete old avatar if exists
        if current_user.avatar_url:
            old_path = os.path.join(settings.ASSET_DIR, current_user.avatar_url)
            if os.path.exists(old_path):
                os.remove(old_path)
        
        # Update user with avatar URL (relative path)
        relative_path = f"avatars/{filename}"
        current_user.avatar_url = relative_path
        db.commit()
        db.refresh(current_user)
        
        return current_user
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload avatar: {str(e)}"
        )


# ✅ Delete Avatar - DELETE method
@router.delete("/avatar")
async def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete user avatar - Any authenticated user"""
    
    print(f"🔍 DELETE avatar called by user: {current_user.id}, role: {current_user.role}")
    
    if not current_user.avatar_url:
        raise HTTPException(
            status_code=404,
            detail="No avatar found"
        )
    
    # Delete file
    file_path = os.path.join(settings.ASSET_DIR, current_user.avatar_url)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Remove from database
    current_user.avatar_url = None
    db.commit()
    
    return {"message": "Avatar deleted successfully"}


# ✅ Delete Avatar - POST method (fallback)
@router.post("/avatar/delete")
async def delete_avatar_post(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete user avatar - POST version (fallback)"""
    
    print(f"🔍 POST avatar/delete called by user: {current_user.id}, role: {current_user.role}")
    
    if not current_user.avatar_url:
        raise HTTPException(
            status_code=404,
            detail="No avatar found"
        )
    
    # Delete file
    file_path = os.path.join(settings.ASSET_DIR, current_user.avatar_url)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Remove from database
    current_user.avatar_url = None
    db.commit()
    
    return {"message": "Avatar deleted successfully"}