
"""AIMS authentication endpoints (mobile + web).

Password reset and email verification require SMTP and frontend action URLs.
They never return secret tokens to unauthenticated callers.
"""

import asyncio
import hashlib
import logging
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.mailer import email_is_configured, send_action_email
from app.core.security import (
    create_access_token,
    decode_token,
    get_current_user,
    get_password_hash,
    require_role,
    verify_password,
)
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserResponse,
    LoginRequest,
    LoginResponse,
    ChangePassword,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)

GENERIC_RESET_MESSAGE = (
    "If your email is registered, you will receive a reset link"
)


class TokenRequest(BaseModel):
    token: str = Field(min_length=10)


def _token_response(user: User) -> LoginResponse:
    return LoginResponse(
        access_token=create_access_token({
            "sub": user.id,
            "role": user.role.value,
            "purpose": "access",
        }),
        token_type="bearer",
        user=user,
    )


def _authenticate(
    db: Session,
    identifier: str,
    password: str,
    mobile: bool,
) -> User:
    identifier = identifier.strip()

    if not identifier:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    if mobile:
        user = db.query(User).filter(
            User.student_id == identifier
        ).first()

        if user is None:
            user = db.query(User).filter(
                func.lower(User.email) == identifier.lower()
            ).first()
    else:
        if identifier.lower() == "admin":
            identifier = "admin@aims.local"

        user = db.query(User).filter(
            func.lower(User.email) == identifier.lower()
        ).first()

    if user is None or not verify_password(
        password, user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is disabled",
        )

    if mobile and user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Please use the web application",
        )

    if not mobile and user.role == UserRole.STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Please use the mobile application",
        )

    return user


@router.post(
    "/register/student",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_student(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    if not user_data.student_id or not user_data.student_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Student ID is required",
        )

    email = str(user_data.email).strip().lower()
    student_id = user_data.student_id.strip()

    if db.query(User).filter(
        func.lower(User.email) == email
    ).first():
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    if db.query(User).filter(
        User.student_id == student_id
    ).first():
        raise HTTPException(
            status_code=409,
            detail="Student ID already registered",
        )

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        first_name=user_data.first_name.strip(),
        last_name=user_data.last_name.strip(),
        phone=user_data.phone,
        student_id=student_id,
        gender=user_data.gender,
        hashed_password=get_password_hash(user_data.password),
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=False,
    )

    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email or student ID already registered",
        ) from exc

    db.refresh(user)
    return user


@router.post(
    "/login/student",
    response_model=LoginResponse,
)
async def login_student(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = _authenticate(
        db,
        login_data.email,
        login_data.password,
        mobile=True,
    )
    return _token_response(user)


@router.post(
    "/register/web",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_web_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if user_data.role in (None, UserRole.STUDENT):
        raise HTTPException(
            status_code=400,
            detail="A non-student role is required",
        )

    email = str(user_data.email).strip().lower()

    if db.query(User).filter(
        func.lower(User.email) == email
    ).first():
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        first_name=user_data.first_name.strip(),
        last_name=user_data.last_name.strip(),
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        role=UserRole(user_data.role),
        is_active=True,
        is_verified=True,
    )

    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        ) from exc

    db.refresh(user)
    return user


@router.post(
    "/login/web",
    response_model=LoginResponse,
)
async def login_web_user(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = _authenticate(
        db,
        login_data.email,
        login_data.password,
        mobile=False,
    )
    return _token_response(user)


@router.post("/login/form")
async def login_user_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    identifier = form_data.username.strip()

    user = db.query(User).filter(
        func.lower(User.email) == identifier.lower()
    ).first()

    if user is None:
        user = db.query(User).filter(
            User.student_id == identifier
        ).first()

    if user is None or not verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is disabled",
        )

    token = _token_response(user)

    return {
        "access_token": token.access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role.value,
            "student_id": user.student_id,
        },
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field in (
        "first_name",
        "last_name",
        "phone",
        "gender",
        "avatar_url",
    ):
        if field in user_data.model_fields_set:
            if field == "avatar_url":
                # Avatar changes must use the authenticated upload API.
                continue

            setattr(current_user, field, getattr(user_data, field))

    if (
        "student_id" in user_data.model_fields_set
        and user_data.student_id != current_user.student_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Contact your coordinator to correct your student ID",
        )

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(
        password_data.current_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Current password is incorrect",
        )

    if verify_password(
        password_data.new_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail="New password must differ from current password",
        )

    current_user.hashed_password = get_password_hash(
        password_data.new_password
    )

    db.commit()
    return {"message": "Password changed successfully"}


def _password_fingerprint(user: User) -> str:
    return hashlib.sha256(
        user.hashed_password.encode("utf-8")
    ).hexdigest()


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    if not email_is_configured() or not settings.PASSWORD_RESET_URL:
        raise HTTPException(
            status_code=503,
            detail="Password reset email service is not configured",
        )

    user = db.query(User).filter(
        func.lower(User.email) == str(request.email).lower()
    ).first()

    if user is not None and user.is_active:
        token = create_access_token(
            {
                "sub": user.id,
                "purpose": "password_reset",
                "pwd": _password_fingerprint(user),
            },
            expires_delta=timedelta(minutes=15),
        )

        try:
            await asyncio.to_thread(
                send_action_email,
                user.email,
                "Reset your AIMS password",
                "This link expires in 15 minutes.",
                settings.PASSWORD_RESET_URL,
                token,
            )
        except Exception:
            logger.exception(
                "Failed to send AIMS password reset email"
            )

    return {"message": GENERIC_RESET_MESSAGE}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    try:
        payload = decode_token(request.token)
    except HTTPException as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token",
        ) from exc

    if (
        payload.get("purpose") != "password_reset"
        or not payload.get("sub")
        or not payload.get("pwd")
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token",
        )

    user = db.query(User).filter(
        User.id == payload["sub"],
        User.is_active.is_(True),
    ).with_for_update().first()

    if user is None or payload["pwd"] != _password_fingerprint(user):
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token",
        )

    if verify_password(
        request.new_password,
        user.hashed_password,
    ):
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="New password must differ from current password",
        )

    user.hashed_password = get_password_hash(
        request.new_password
    )

    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/request-email-verification")
async def request_email_verification(
    current_user: User = Depends(get_current_user),
):
    if current_user.is_verified:
        return {"message": "Email is already verified"}

    if not email_is_configured() or not settings.EMAIL_VERIFICATION_URL:
        raise HTTPException(
            status_code=503,
            detail="Email verification service is not configured",
        )

    token = create_access_token(
        {
            "sub": current_user.id,
            "purpose": "email_verification",
            "email": current_user.email,
        },
        expires_delta=timedelta(hours=24),
    )

    try:
        await asyncio.to_thread(
            send_action_email,
            current_user.email,
            "Verify your AIMS email",
            "This verification link expires in 24 hours.",
            settings.EMAIL_VERIFICATION_URL,
            token,
        )
    except Exception as exc:
        logger.exception("Failed to send verification email")
        raise HTTPException(
            status_code=503,
            detail="Could not send verification email",
        ) from exc

    return {"message": "Verification email sent"}


@router.post("/verify-email")
async def verify_email(
    request: TokenRequest,
    db: Session = Depends(get_db),
):
    try:
        payload = decode_token(request.token)
    except HTTPException as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification token",
        ) from exc

    if payload.get("purpose") != "email_verification":
        raise HTTPException(
            status_code=400,
            detail="Invalid verification token",
        )

    user = db.query(User).filter(
        User.id == payload.get("sub"),
        User.is_active.is_(True),
    ).first()

    if (
        user is None
        or user.email.lower()
        != str(payload.get("email", "")).lower()
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid verification token",
        )

    user.is_verified = True
    db.commit()

    return {"message": "Email verified successfully"}


@router.post(
    "/verify-email/{user_id}",
    status_code=410,
    deprecated=True,
)
async def legacy_verify_email_disabled(user_id: str):
    raise HTTPException(
        status_code=410,
        detail="Use /request-email-verification and /verify-email",
    )
