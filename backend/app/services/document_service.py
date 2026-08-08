from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException
import uuid
import os

from app.models.document import Document, DocumentType
from app.services.ocr_service import OCRService
from app.core.config import settings


class DocumentService:

    REQUIRED_HEADERS = {
        "resume": "resume",
        "application_letter": "application letter",
        "endorsement_letter": "endorsement letter",
        "acceptance_letter": "acceptance letter",
        "certificate_of_completion": "certificate of completion",
        "requirements": "requirements"
    }

    @classmethod
    def verify_document(cls, document_type: str, extracted_text: str) -> bool:
        """Verify if the extracted text matches the document type"""
        expected = cls.REQUIRED_HEADERS.get(document_type)
        if expected is None:
            return False
        return expected.lower() in extracted_text.lower()

    @classmethod
    def upload_document(
        cls,
        db: Session,
        file: UploadFile,
        document_type: str,
        description: str,
        uploaded_by: str
    ) -> dict:
        """Upload document, run OCR, verify, and save to database"""
        try:
            # Save file and get relative path + file type
            relative_path, file_type = OCRService.save_file(file)
            
            # Get full path for text extraction
            full_path = os.path.join(settings.ASSET_DIR, relative_path)
            
            # Extract text based on file type
            extracted_text = OCRService.extract_text(full_path, file_type)

            # Verify document
            verified = cls.verify_document(document_type, extracted_text)
            status = "verified" if verified else "rejected"

            # Convert string to DocumentType enum
            try:
                doc_type_enum = DocumentType(document_type)
            except ValueError:
                doc_type_enum = DocumentType.DOCUMENT

            # Create document record with file info
            document = Document(
                id=str(uuid.uuid4()),
                type=doc_type_enum,
                description=description,
                file_path=relative_path,
                uploaded_by=uploaded_by,
                verification_status=status,
                extracted_text=extracted_text
            )

            db.add(document)
            db.commit()
            db.refresh(document)

            return {
                "verified": verified,
                "status": status,
                "document": document,
                "extracted_text": extracted_text,
                "file_type": file_type
            }

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")