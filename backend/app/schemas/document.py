# backend/app/schemas/document.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    DOCUMENT = "document"
    TRANSCRIPT = "transcript"
    USER_ID = "user_id"


class DocumentBase(BaseModel):
    type: DocumentType
    description: Optional[str] = None
    file_path: str


class DocumentCreate(DocumentBase):
    uploaded_by: str


class DocumentResponse(BaseModel):
    id: str
    type: str
    description: Optional[str]
    file_path: str
    verification_status: str
    extracted_text: Optional[str]
    validation_confidence: Optional[int]  # ✅ NEW
    validation_message: Optional[str]     # ✅ NEW
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True