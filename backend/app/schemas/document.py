# backend/app/schemas/document.py
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
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
    description: Optional[str] = None
    original_filename: Optional[str] = None
    file_path: str
    verification_status: str
    extracted_text: Optional[str] = None
    validation_confidence: Optional[int] = None
    validation_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    """
    Response shape for POST /documents/upload.

    Forces FastAPI to serialize the ORM `document` object using
    DocumentResponse so the client gets a real `document.id`.
    """
    verified: bool
    status: str
    document: DocumentResponse
    extracted_text: str
    file_type: str
    validation: Optional[Dict[str, Any]] = None