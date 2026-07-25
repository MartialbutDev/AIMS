from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import uuid
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    decode_token
)
from app.core.config import settings
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserResponse,
    LoginRequest,
    LoginResponse,
    ChangePassword,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserUpdate
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ==================== MOBILE APP ENDPOINTS (STUDENT ONLY) ====================

@router.post("/register/student", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_student(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new student (Mobile App Only)
    - Students can only register with role = "student"
    """
    
    # Force role to be STUDENT
    user_data.role = UserRole.STUDENT
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Student ID is required for students
    if not user_data.student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID is required"
        )
    
    # Check if student_id already exists
    existing_student = db.query(User).filter(User.student_id == user_data.student_id).first()
    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID already registered"
        )
    
    # Create new user
    new_user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        student_id=user_data.student_id,
        hashed_password=get_password_hash(user_data.password),
        role=UserRole.STUDENT,  # Force student role
        is_active=True,
        is_verified=False
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login/student", response_model=LoginResponse)
async def login_student(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Student Login (Mobile App Only)
    - Students can login with either email or student_id
    - Only users with role "student" can login through this endpoint
    """
    
    login_identifier = login_data.email
    
    # Try to find user by student_id first (for mobile app login)
    user = db.query(User).filter(User.student_id == login_identifier).first()
    
    # If not found, try by email
    if not user:
        user = db.query(User).filter(User.email == login_identifier).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid student ID/email or password"
        )
    
    # Check if user is a student
    if user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Please use the web application."
        )
    
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid student ID/email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value}
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


# ==================== WEB APP ENDPOINTS (ALL STAKEHOLDERS) ====================

@router.post("/register/web", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_web_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a user (Web App Only)
    - Can create: coordinator, dean, career_center, hte_supervisor, admin
    - Student role is NOT allowed through this endpoint
    """
    
    # Check if role is allowed for web registration
    if user_data.role == UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Students must register through the mobile app"
        )
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    new_user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        student_id=user_data.student_id,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        is_active=True,
        is_verified=True  # Web users are pre-verified
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login/web", response_model=LoginResponse)
async def login_web_user(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Web App Login
    - For: coordinator, dean, career_center, hte_supervisor, admin
    - Students CANNOT login through this endpoint
    """
    
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if user is a student
    if user.role == UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Please use the mobile application."
        )
    
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value}
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.post("/login/form")
async def login_user_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    OAuth2 Login (For Swagger UI testing)
    - Works for all roles
    """
    
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role.value,
            "student_id": user.student_id
        }
    }


# ==================== SHARED ENDPOINTS ====================

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current logged-in user information (Works for all roles)"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user information (Works for all roles)"""
    
    if user_data.first_name is not None:
        current_user.first_name = user_data.first_name
    if user_data.last_name is not None:
        current_user.last_name = user_data.last_name
    if user_data.phone is not None:
        current_user.phone = user_data.phone
    if user_data.student_id is not None:
        # Students can update their student_id
        if current_user.role == UserRole.STUDENT:
            existing = db.query(User).filter(
                User.student_id == user_data.student_id,
                User.id != current_user.id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Student ID already taken"
                )
            current_user.student_id = user_data.student_id
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.post("/change-password")
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password (Works for all roles)"""
    
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Request password reset link (Works for all roles)"""
    
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        return {"message": "If your email is registered, you will receive a reset link"}
    
    reset_token = create_access_token(
        data={"sub": user.id, "purpose": "password_reset"},
        expires_delta=timedelta(minutes=15)
    )
    
    return {
        "message": "If your email is registered, you will receive a reset link",
        "reset_token": reset_token
    }


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using token (Works for all roles)"""
    
    try:
        payload = decode_token(request.token)
        user_id = payload.get("sub")
        purpose = payload.get("purpose")
        
        if purpose != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token purpose"
            )
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user.hashed_password = get_password_hash(request.new_password)
        db.commit()
        
        return {"message": "Password reset successfully"}
        
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )


@router.post("/verify-email/{user_id}")
async def verify_email(user_id: str, db: Session = Depends(get_db)):
    """Verify user's email address (Works for all roles)"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_verified = True
    db.commit()
    
    return {"message": "Email verified successfully"}