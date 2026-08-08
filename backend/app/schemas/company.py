from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class CompanyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    is_active: Optional[bool] = None
    is_moa_signed: Optional[bool] = None


class CompanyResponse(CompanyBase):
    id: str
    is_active: bool
    is_moa_signed: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True