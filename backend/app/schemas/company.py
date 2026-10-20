
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


class CompanyCreate(CompanyBase):
    is_moa_signed: bool = False
    moa_reference: Optional[str] = Field(None, max_length=120)
    moa_signed_at: Optional[date] = None
    moa_effective_at: Optional[date] = None
    moa_expires_at: Optional[date] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = Field(None, max_length=500)
    contact_person: Optional[str] = Field(None, max_length=100)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)

    is_active: Optional[bool] = None
    is_moa_signed: Optional[bool] = None

    moa_reference: Optional[str] = Field(None, max_length=120)
    moa_signed_at: Optional[date] = None
    moa_effective_at: Optional[date] = None
    moa_expires_at: Optional[date] = None


class CompanyResponse(CompanyBase):
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
