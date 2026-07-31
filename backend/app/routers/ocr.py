import re
import shutil
from os import path

import pytesseract
from fastapi import APIRouter, File, UploadFile, HTTPException, Request, UploadFile, status, Depends, Form
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from pytesseract.pytesseract import TesseractError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.document_service import DocumentService

from app.core.config import settings
from app.services.ocr_service import OCRService

ocr_router = APIRouter(
    prefix="/ocr",
    tags=["ocr"]
)

ASSET_DIR = settings.ASSET_DIR

templates = Jinja2Templates(directory=path.join(ASSET_DIR, "templates"))

@ocr_router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: str = Form(...),
    db: Session = Depends(get_db)
):
    uploaded_by = "test_user_id" # todo: change this to actual user 
    result = DocumentService.upload_document(
        db=db,
        file=file,
        document_type=document_type,
        description=description,
        uploaded_by=uploaded_by
    )
    return result

