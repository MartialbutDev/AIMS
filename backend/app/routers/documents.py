from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import os
import mimetypes

from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_from_token
from app.models.user import User
from app.models.document import Document, DocumentType
from app.services.document_service import DocumentService
from app.core.config import settings

documents_router = APIRouter(
    prefix="/documents",
    tags=["documents"]
)


@documents_router.get("/")
async def get_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents for the current user"""
    documents = db.query(Document).filter(Document.uploaded_by == current_user.id).all()
    return documents


@documents_router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a document for OCR processing"""
    result = DocumentService.upload_document(
        db=db,
        file=file,
        document_type=document_type,
        description=description,
        uploaded_by=current_user.id
    )
    return result


@documents_router.get("/{document_id}")
async def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific document by ID"""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.uploaded_by == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document


@documents_router.get("/{document_id}/image")
async def get_document_image(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Get document file for preview"""
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.uploaded_by == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Construct full path
    full_path = os.path.join(settings.ASSET_DIR, document.file_path)
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    content_type, _ = mimetypes.guess_type(full_path)
    if not content_type:
        content_type = "application/octet-stream"
    
    return FileResponse(
        full_path,
        media_type=content_type,
        filename=os.path.basename(full_path)
    )