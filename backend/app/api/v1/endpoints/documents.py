# backend/app/api/v1/endpoints/documents.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import os
import mimetypes

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.document_service import DocumentService
from app.schemas.document import DocumentResponse
from app.core.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=dict)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload and validate a document"""
    
    valid_types = [
        "resume", "application_letter", "endorsement_letter",
        "certificate_of_completion", "acceptance_letter", "requirements"
    ]
    
    if document_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Must be one of: {', '.join(valid_types)}"
        )
    
    try:
        result = DocumentService.upload_document(
            db=db,
            file=file,
            document_type=document_type,
            description=description or "",
            uploaded_by=current_user.id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/", response_model=List[DocumentResponse])
async def get_user_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's documents"""
    
    documents = db.query(Document).filter(
        Document.uploaded_by == current_user.id
    ).order_by(Document.created_at.desc()).all()
    
    return documents


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific document"""
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.uploaded_by == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document


# ✅ FIXED: Get document file with proper content type
@router.get("/{document_id}/image")
async def get_document_image(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get document file (image or PDF)"""
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.uploaded_by == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = os.path.join(settings.ASSET_DIR, document.file_path)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # ✅ Get file extension and determine content type
    ext = os.path.splitext(file_path)[1].lower()
    
    # ✅ Proper MIME types
    media_types = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.heic': 'image/heic',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
    }
    
    media_type = media_types.get(ext, 'application/octet-stream')
    filename = os.path.basename(file_path)
    
    # ✅ Log for debugging
    print(f"📄 Serving file: {filename} ({media_type})")
    
    # ✅ Return with proper headers
    return FileResponse(
        file_path,
        media_type=media_type,
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600",
        }
    )