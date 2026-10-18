
"""Pydantic user schemas shared by mobile and web clients."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator
)

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr

    first_name: str = Field(
        min_length=1,
        max_length=100
    )

    last_name: str = Field(
        min_length=1,
        max_length=100
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=20
    )

    student_id: Optional[str] = Field(
        default=None,
        max_length=50
    )

    gender: Optional[
        Literal[
            "male",
            "female",
            "other",
            "prefer_not_to_say"
        ]
    ] = None

    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(
        min_length=8,
        max_length=128
    )

    role: Optional[UserRole] = UserRole.STUDENT


class AdminUserCreate(BaseModel):
    email: EmailStr

    first_name: str = Field(
        min_length=1,
        max_length=100
    )

    last_name: str = Field(
        min_length=1,
        max_length=100
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=20
    )

    password: str = Field(
        min_length=8,
        max_length=128
    )

    role: UserRole

    @field_validator("role")
    @classmethod
    def reject_student_role(
        cls,
        value: UserRole
    ) -> UserRole:
        if value == UserRole.STUDENT:
            raise ValueError(
                "Students must register through the student signup flow"
            )

        return value


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100
    )

    last_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=20
    )

    student_id: Optional[str] = Field(
        default=None,
        max_length=50
    )

    gender: Optional[
        Literal[
            "male",
            "female",
            "other",
            "prefer_not_to_say"
        ]
    ] = None

    avatar_url: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str

    new_password: str = Field(
        min_length=8,
        max_length=128
    )


class UserResponse(UserBase):
    id: str
    email: str
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True
    )


class UserImportResponse(BaseModel):
    created_count: int
    users: List[UserResponse]


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str

    new_password: str = Field(
        min_length=8,
        max_length=128
    )


class TokenData(BaseModel):
    user_id: str
    role: UserRole
