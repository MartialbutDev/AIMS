
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CompanyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = Field(None, max_length=500)
    contact_person: Optional[str] = Field(None, max_length=100)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    ustp_coverage: str | None = Field(default=None, max_length=255)
    nature_of_partnership: str | None = Field(default=None, max_length=255)
    moa_notarized: bool | None = Field(default=None, strict=True)
    moa_notarized_at: date | None = Field(default=None, ge=date(1000, 1, 1))
    moa_notarized_year: int | None = Field(default=None, ge=1000, le=9999, strict=True)
    moa_effectivity_years: int | None = Field(default=None, gt=0, le=9999, strict=True)


class CompanyCreate(CompanyBase):
    intern_capacity: int = Field(gt=0, le=100000, strict=True)
    is_moa_signed: bool = False
    moa_reference: Optional[str] = Field(None, max_length=120)
    moa_signed_at: Optional[date] = None
    moa_effective_at: Optional[date] = None
    moa_expires_at: Optional[date] = None


class CompanyUpdate(BaseModel):
    intern_capacity: int | None = Field(default=None, gt=0, le=100000, strict=True)
    intake_version: int | None = Field(default=None, ge=0, strict=True)
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = Field(None, max_length=500)
    contact_person: Optional[str] = Field(None, max_length=100)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    ustp_coverage: str | None = Field(default=None, max_length=255)
    nature_of_partnership: str | None = Field(default=None, max_length=255)
    moa_notarized: bool | None = Field(default=None, strict=True)
    moa_notarized_at: date | None = Field(default=None, ge=date(1000, 1, 1))
    moa_notarized_year: int | None = Field(default=None, ge=1000, le=9999, strict=True)
    moa_effectivity_years: int | None = Field(default=None, gt=0, le=9999, strict=True)

    is_active: Optional[bool] = None
    is_moa_signed: Optional[bool] = None

    moa_reference: Optional[str] = Field(None, max_length=120)
    moa_signed_at: Optional[date] = None
    moa_effective_at: Optional[date] = None
    moa_expires_at: Optional[date] = None


class CompanyIntakeSummary(BaseModel):
    academic_year: str
    semester: str
    capacity: int | None
    accepted: int
    remaining: int | None
    accepting: bool
    status: str
    can_apply: bool
    version: int


class CompanyResponse(CompanyBase):
    intake: CompanyIntakeSummary | None = None
    id: str
    is_active: bool
    is_moa_signed: bool

    moa_reference: Optional[str] = None
    moa_signed_at: Optional[date] = None
    moa_effective_at: Optional[date] = None
    moa_expires_at: Optional[date] = None

    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
