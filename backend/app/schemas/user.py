from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    STUDENT = "student"
    COORDINATOR = "coordinator"
    DEAN = "dean"
    CAREER_CENTER = "career_center"
    HTE_SUPERVISOR = "hte_supervisor"
    ADMIN = "admin"


# Base User Schema
class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    student_id: Optional[str] = Field(None, max_length=50)
    avatar_url: Optional[str] = None  # ✅ ADDED


# Create User (Registration)
class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: Optional[UserRole] = UserRole.STUDENT


class AdminUserCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    password: str = Field(..., min_length=6)
    role: UserRole

    @field_validator("role")
    @classmethod
    def reject_student_role(cls, value: UserRole) -> UserRole:
        if value == UserRole.STUDENT:
            raise ValueError("Students must register through the student signup flow")
        return value


# Update User
class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    student_id: Optional[str] = Field(None, max_length=50)
    avatar_url: Optional[str] = None  # ✅ ADDED


# Change Password
class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# User Response
class UserResponse(UserBase):
    id: str
    email: str
    role: UserRole
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None  # ✅ ADDED
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserImportResponse(BaseModel):
    created_count: int
    users: List[UserResponse]


# Login Request - FIXED: email is now a string to accept both student_id and email
class LoginRequest(BaseModel):
    email: str  # Changed from EmailStr to str
    password: str


# Login Response
class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Forgot Password Request
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# Reset Password Request
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


# Token Data
class TokenData(BaseModel):
    user_id: str
    role: UserRole