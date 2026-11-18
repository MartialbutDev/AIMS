# backend/app/api/v1/endpoints/users.py
import csv
import logging
from pathlib import Path
import io
import uuid
from typing import List, Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query, status
from pydantic import BaseModel, Field, ValidationError
from PIL import Image
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import os
from datetime import datetime, timezone
from sqlalchemy import func, select, or_
from app.core.database import Base
from app.models.auth_session import AuthSession, AuthSessionCutoff
from app.models.push import PushDevice
from app.models.password_reset import PasswordResetChallenge

from app.core.avatar_images import MAX_AVATAR_BYTES, encode_avatar
from app.core.database import get_db
from app.core.assignment_access import get_current_academic_term
from app.core.security import get_current_user, get_password_hash, require_role
from app.models.coordinator_assignment import CoordinatorStudentAssignment
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation
from app.models.user import User, UserRole
from app.schemas.user import (
    AdminUserCreate,
    UserImportResponse,
    UserResponse,
    AdminUserUpdate,
)
from app.core.config import settings

router = APIRouter()

MAX_CSV_BYTES = 2 * 1024 * 1024
MAX_CSV_ROWS = 500
CSV_REQUIRED_COLUMNS = {"email", "first_name", "last_name", "role", "password"}


class CoordinatorAssignmentInput(BaseModel):
    coordinator_id: str = Field(min_length=1, max_length=36)
    student_id: str = Field(min_length=1, max_length=36)
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    semester: Literal["1", "2"]


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


def _require_current_assignment_term(academic_year: str, semester: str) -> tuple[str, str]:
    current = get_current_academic_term()
    if (academic_year, semester) != current:
        raise HTTPException(409, "The academic term changed or is historical. Refresh Student Assignments before continuing.")
    return current


@router.get("/coordinator-assignments")
async def get_coordinator_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Show only current-term assignments; preserve past-term rosters."""
    year, semester = get_current_academic_term()
    coordinators = db.query(User).filter(User.role == UserRole.COORDINATOR,
        User.is_active.is_(True)).order_by(User.last_name, User.first_name).all()
    eligible = {row[0] for row in db.query(DeanCoordinatorDesignation.coordinator_id).filter(
        DeanCoordinatorDesignation.academic_year == year, DeanCoordinatorDesignation.semester == semester,
        DeanCoordinatorDesignation.is_active.is_(True)).all()}
    students = db.query(User).filter(User.role == UserRole.STUDENT,
        User.is_active.is_(True)).order_by(User.last_name, User.first_name).all()
    assignments = db.query(CoordinatorStudentAssignment, User).join(User,
        User.id == CoordinatorStudentAssignment.student_id).filter(User.role == UserRole.STUDENT,
        CoordinatorStudentAssignment.academic_year == year,
        CoordinatorStudentAssignment.semester == semester).all()
    groups = {}
    assigned = set()
    for assignment, student in assignments:
        assigned.add(student.id)
        groups.setdefault(assignment.coordinator_id, []).append({"id": student.id,
            "student_id": student.student_id, "name": f"{student.first_name} {student.last_name}".strip()})
    return {"academic_year": year, "semester": semester,
        "coordinators": [{"id": user.id, "name": f"{user.first_name} {user.last_name}".strip(),
            "can_assign": user.id in eligible, "students": groups.get(user.id, [])} for user in coordinators],
        "unassigned_students": [{"id": user.id, "student_id": user.student_id,
            "name": f"{user.first_name} {user.last_name}".strip()} for user in students if user.id not in assigned]}


@router.post("/coordinator-assignments", status_code=status.HTTP_201_CREATED)
async def create_coordinator_assignment(
    assignment_data: CoordinatorAssignmentInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    year, semester = _require_current_assignment_term(assignment_data.academic_year, assignment_data.semester)
    student = db.query(User).filter(User.id == assignment_data.student_id,
        User.role == UserRole.STUDENT, User.is_active.is_(True)).with_for_update().first()
    if student is None:
        raise HTTPException(404, "Active student not found")
    coordinator = db.query(User).filter(User.id == assignment_data.coordinator_id,
        User.role == UserRole.COORDINATOR, User.is_active.is_(True)).with_for_update().first()
    if coordinator is None:
        raise HTTPException(404, "Active coordinator not found")
    designation = db.query(DeanCoordinatorDesignation).filter(
        DeanCoordinatorDesignation.coordinator_id == coordinator.id,
        DeanCoordinatorDesignation.academic_year == year,
        DeanCoordinatorDesignation.semester == semester,
        DeanCoordinatorDesignation.is_active.is_(True)).with_for_update().first()
    if designation is None:
        raise HTTPException(403, "Coordinator has no active administrator-authorized designation for this academic term")
    existing = db.query(CoordinatorStudentAssignment).filter_by(student_id=student.id,
        academic_year=year, semester=semester).first()
    if existing:
        raise HTTPException(409, "Student is already assigned to a coordinator for this academic term")
    assignment = CoordinatorStudentAssignment(coordinator_id=coordinator.id, student_id=student.id,
        academic_year=year, semester=semester)
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        code = getattr(exc.orig, "pgcode", None) or getattr(exc.orig, "sqlstate", None)
        if code == "23505" or "unique constraint" in str(exc.orig).lower():
            raise HTTPException(409, "Student is already assigned to a coordinator for this academic term") from exc
        raise HTTPException(500, "Assignment could not be saved. Ask the administrator to check the database schema.") from exc
    return {"coordinator_id": coordinator.id, "student_id": student.id, "academic_year": year, "semester": semester}


@router.delete("/coordinator-assignments/{coordinator_id}/{student_id}")
async def delete_coordinator_assignment(
    coordinator_id: str, student_id: str,
    academic_year: str = Query(..., pattern=r"^\d{4}-\d{4}$"),
    semester: Literal["1", "2"] = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    year, term = _require_current_assignment_term(academic_year, semester)
    db.query(User).filter(User.id == student_id).with_for_update().first()
    assignment = db.query(CoordinatorStudentAssignment).filter_by(coordinator_id=coordinator_id,
        student_id=student_id, academic_year=year, semester=term).with_for_update().first()
    if assignment is None:
        raise HTTPException(404, "Coordinator assignment not found in the current academic term")
    db.delete(assignment)
    db.commit()
    return {"message": "Current-term student assignment removed; historical assignments preserved"}


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


def _managed_user(db: Session, user_id: str) -> User:
    # Lock administrators in a consistent order so concurrent access changes
    # cannot remove the last active administrator.
    db.query(User).filter(User.role == UserRole.ADMIN).order_by(User.id).with_for_update().all()
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if user is None:
        raise HTTPException(404, "User not found")
    return user


def _protect_admin_access(db: Session, user: User, actor: User) -> None:
    if user.id == actor.id:
        raise HTTPException(409, "You cannot deactivate or delete your own account.")
    if user.role == UserRole.ADMIN and user.is_active:
        count = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active.is_(True)).count()
        if count <= 1:
            raise HTTPException(409, "At least one active administrator must remain.")


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    try:
        user = _managed_user(db, user_id)
        changes = user_data.model_dump(exclude_unset=True)
        if changes.get("is_active") is False:
            _protect_admin_access(db, user, current_user)
        if "email" in changes:
            changes["email"] = str(changes["email"]).lower()
            if db.query(User.id).filter(func.lower(User.email) == changes["email"], User.id != user.id).first():
                raise HTTPException(409, "Email already registered.")
        email_changed = "email" in changes and changes["email"] != user.email.lower()
        if email_changed and user.id == current_user.id:
            raise HTTPException(409, "Your signed-in email cannot be changed from User Management.")
        for key, value in changes.items():
            setattr(user, key, value)
        if email_changed:
            user.is_verified = False
        if email_changed or changes.get("is_active") is False:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            db.query(PasswordResetChallenge).filter(PasswordResetChallenge.user_id == user.id).delete(synchronize_session=False)
            db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None)).update({"revoked_at": now}, synchronize_session=False)
            cutoff = db.get(AuthSessionCutoff, user.id)
            if cutoff is None:
                cutoff = AuthSessionCutoff(user_id=user.id); db.add(cutoff)
            cutoff.revoked_before = now
            db.query(PushDevice).filter(PushDevice.user_id == user.id).update({"active": False}, synchronize_session=False)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "These details conflict with another account.") from exc
    except Exception:
        db.rollback()
        raise


@router.delete("/avatar")
@router.post("/avatar/delete")
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.refresh(current_user, with_for_update=True)
    old_url = current_user.avatar_url
    if not old_url:
        raise HTTPException(status_code=404, detail="No avatar found")

    current_user.avatar_url = None
    db.commit()
    _remove_previous_avatar(db, current_user.id, old_url)
    return {"message": "Avatar deleted successfully"}


# Keep the specific avatar DELETE route above this parameterized route.
@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Delete unused accounts, retaining all academic and administrative history."""
    disposable = {"auth_sessions", "auth_session_cutoffs", "password_reset_challenges", "password_reset_revocations", "notification_settings", "notification_delivery_preferences"}
    try:
        user = _managed_user(db, user_id)
        _protect_admin_access(db, user, current_user)
        for table in Base.metadata.sorted_tables:
            if table.name == "users" or table.name in disposable:
                continue
            # Include legacy ownership fields that predate foreign keys.
            references = [column for column in table.columns if
                any(fk.target_fullname == "users.id" for fk in column.foreign_keys)
                or column.name in {"uploaded_by", "reviewer_id", "user_id", "student_id", "coordinator_id", "actor_id"}
                or column.name.endswith("_by")]
            if references and db.execute(select(table).where(or_(*(column == user.id for column in references))).limit(1)).first():
                raise HTTPException(409, "This account has linked records and cannot be deleted. Edit the account and set it to Inactive to remove access while preserving history.")
        for table in reversed(Base.metadata.sorted_tables):
            if table.name in disposable:
                db.execute(table.delete().where(table.c.user_id == user.id))
        avatar_root = (Path(settings.ASSET_DIR) / "avatars").resolve()
        avatar = (Path(settings.ASSET_DIR) / user.avatar_url).resolve() if user.avatar_url else None
        shared_avatar = user.avatar_url and db.query(User.id).filter(User.id != user.id, User.avatar_url == user.avatar_url).first()
        db.delete(user)
        db.commit()
        if avatar and not shared_avatar and avatar.parent == avatar_root and avatar.name.startswith(f"avatar_{user_id}_"):
            try:
                avatar.unlink(missing_ok=True)
            except OSError:
                logging.getLogger(__name__).exception("Unable to clean up deleted account avatar")
        return {"message": "User deleted successfully"}
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "This account has linked records. Set it to Inactive instead.") from exc
    except Exception:
        db.rollback()
        raise


# ✅ Upload Avatar - Any authenticated user
@router.post("/avatar", response_model=UserResponse)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the authenticated user's avatar with a decoded raster image."""
    content = file.file.read(MAX_AVATAR_BYTES + 1)
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Profile photos must be 5 MB or smaller.")

    try:
        encoded, extension = encode_avatar(content)
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(
            status_code=400,
            detail="Choose a valid JPEG, PNG, or WebP photo with no more than 20 megapixels.",
        ) from None

    avatar_dir = (Path(settings.ASSET_DIR) / "avatars").resolve()
    prefix = f"avatar_{current_user.id}_"
    filename = f"{prefix}{uuid.uuid4().hex}{extension}"
    path = avatar_dir / filename
    logger = logging.getLogger(__name__)
    try:
        # Serialize replacements for this user, and keep the old photo until commit.
        db.refresh(current_user, with_for_update=True)
        old_url = current_user.avatar_url
        avatar_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encoded)
        current_user.avatar_url = f"avatars/{filename}"
        db.commit()
    except Exception:
        db.rollback()
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.exception("Unable to remove an uncommitted avatar")
        logger.exception("Unable to update avatar")
        raise HTTPException(status_code=500, detail="Could not update your profile photo.") from None

    _remove_previous_avatar(db, current_user.id, old_url)
    return current_user


def _remove_previous_avatar(db: Session, user_id: str, old_url: str | None) -> None:
    if not old_url:
        return

    try:
        avatar_dir = (Path(settings.ASSET_DIR) / "avatars").resolve()
        old_path = (Path(settings.ASSET_DIR) / old_url).resolve()
        if old_path.parent != avatar_dir or not old_path.name.startswith(f"avatar_{user_id}_"):
            return
        if not db.query(User.id).filter(User.avatar_url == old_url).first():
            old_path.unlink(missing_ok=True)
    except Exception:
        logging.getLogger(__name__).exception("Unable to clean up the previous avatar")
