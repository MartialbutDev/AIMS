# backend/app/services/document_service.py
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException
import uuid
import os

from app.models.document import Document, DocumentType
from app.services.ocr_service import OCRService
from app.core.config import settings
from app.utils.document_keywords import (
    validate_resume,
    validate_application_letter,
    validate_endorsement_letter,
    validate_certificate_of_completion,
    validate_generic_document,
    validate_waiver,
    validate_medical_certificate,
    validate_internship_plan,
    validate_insurance,
)


class DocumentService:

    VALIDATION_FUNCTIONS = {
        # Application docs
        "resume": validate_resume,
        "application_letter": validate_application_letter,

        # Pre-deployment / CHED-required
        "waiver": validate_waiver,
        "medical_certificate": validate_medical_certificate,
        "internship_plan": validate_internship_plan,
        "insurance": validate_insurance,
        "endorsement_letter": validate_endorsement_letter,

        # Post-selection
        "certificate_of_completion": validate_certificate_of_completion,
        "acceptance_letter": validate_generic_document,
        "requirements": validate_generic_document,
    }

    _TYPE_ALIASES = {
        "resume": "RESUME",
        "application_letter": "APPLICATION_LETTER",
        "waiver": "WAIVER",
        "medical_certificate": "MEDICAL_CERTIFICATE",
        "internship_plan": "INTERNSHIP_PLAN",
        "insurance": "INSURANCE",
        "endorsement_letter": "ENDORSEMENT_LETTER",
        "acceptance_letter": "ACCEPTANCE_LETTER",
        "certificate_of_completion": "CERTIFICATE_OF_COMPLETION",
        "requirements": "REQUIREMENTS",
        "document": "DOCUMENT",
        "transcript": "TRANSCRIPT",
        "user_id": "USER_ID",
    }

    @classmethod
    def _resolve_type(cls, document_type: str) -> DocumentType:
        key = (document_type or "").strip().lower()
        member_name = cls._TYPE_ALIASES.get(key) or key.upper()
        try:
            return DocumentType[member_name]
        except KeyError:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported document_type: {document_type}",
            )

    @classmethod
    def verify_document(cls, document_type: str, extracted_text: str) -> dict:
        validation_func = cls.VALIDATION_FUNCTIONS.get(document_type)

        if validation_func is None:
            return {
                "is_valid": False,
                "confidence": 0,
                "message": f"Unknown document type: {document_type}.",
                "found_sections": [],
                "score": 0,
                "total_sections": 0,
            }

        return validation_func(extracted_text)

    @classmethod
    def upload_document(
        cls,
        db: Session,
        file: UploadFile,
        document_type: str,
        description: str,
        uploaded_by: str,
    ) -> dict:
        try:
            original_filename = (file.filename or "").strip() or None

            relative_path, file_type = OCRService.save_file(file)
            full_path = os.path.join(settings.ASSET_DIR, relative_path)

            extracted_text = OCRService.extract_text(full_path, file_type)

            validation_result = cls.verify_document(document_type, extracted_text)
            is_valid = validation_result.get("is_valid", False)
            confidence = validation_result.get("confidence", 0)

            text_len = len((extracted_text or "").strip())

            if text_len < 100 or not is_valid:
                status = "rejected"
            else:
                status = "verified"

            doc_type_enum = cls._resolve_type(document_type)

            document = Document(
                id=str(uuid.uuid4()),
                type=doc_type_enum,
                description=description,
                original_filename=original_filename,
                file_path=relative_path,
                uploaded_by=uploaded_by,
                verification_status=status,
                extracted_text=extracted_text[:5000],
                validation_confidence=confidence,
                validation_message=validation_result.get("message", ""),
            )

            db.add(document)
            db.commit()
            db.refresh(document)

            return {
                "verified": status == "verified",
                "status": status,
                "document": document,
                "extracted_text": extracted_text[:500],
                "file_type": file_type,
                "validation": validation_result,
            }

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error uploading document: {str(e)}",
            )