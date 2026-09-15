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
)


class DocumentService:

    # Document types and their validation functions (keyed by client slug)
    VALIDATION_FUNCTIONS = {
        "resume": validate_resume,
        "application_letter": validate_application_letter,
        "endorsement_letter": validate_endorsement_letter,
        "certificate_of_completion": validate_certificate_of_completion,
        "acceptance_letter": validate_generic_document,
        "requirements": validate_generic_document,
    }

    # Client sends lowercase slugs; the enum members (and Postgres enum values)
    # are UPPERCASE. Map slug → enum member name.
    _TYPE_ALIASES = {
        "resume": "RESUME",
        "application_letter": "APPLICATION_LETTER",
        "endorsement_letter": "ENDORSEMENT_LETTER",
        "acceptance_letter": "ACCEPTANCE_LETTER",
        "certificate_of_completion": "CERTIFICATE_OF_COMPLETION",
        "requirements": "REQUIREMENTS",
        # legacy / misc
        "document": "DOCUMENT",
        "transcript": "TRANSCRIPT",
        "user_id": "USER_ID",
    }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def _resolve_type(cls, document_type: str) -> DocumentType:
        """
        Map a client-supplied slug (case-insensitive) to a DocumentType enum member.

        - "resume"             → DocumentType.RESUME             (stores as "RESUME")
        - "application_letter" → DocumentType.APPLICATION_LETTER (stores as "APPLICATION_LETTER")
        - unknown              → 400
        """
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
        """
        Verify if the extracted text matches the document type using keyword validation.

        Returns:
            {
                "is_valid": bool,
                "confidence": int,
                "message": str,
                "found_sections": list,
                "score": int,
                "total_sections": int
            }
        """
        validation_func = cls.VALIDATION_FUNCTIONS.get(document_type)

        if validation_func is None:
            return {
                "is_valid": True,
                "confidence": 50,
                "message": f"Unknown document type: {document_type}. Allowed by default.",
                "found_sections": [],
                "score": 0,
                "total_sections": 0,
            }

        return validation_func(extracted_text)

    # ------------------------------------------------------------------
    # Upload
    # ------------------------------------------------------------------

    @classmethod
    def upload_document(
        cls,
        db: Session,
        file: UploadFile,
        document_type: str,
        description: str,
        uploaded_by: str,
    ) -> dict:
        """Upload document, run OCR, verify with keyword validation, and save to database."""
        try:
            # Save file and get relative path + file type
            relative_path, file_type = OCRService.save_file(file)

            # Get full path for text extraction
            full_path = os.path.join(settings.ASSET_DIR, relative_path)

            # Extract text based on file type
            extracted_text = OCRService.extract_text(full_path, file_type)

            # ✅ Verify document using keyword validation
            validation_result = cls.verify_document(document_type, extracted_text)

            is_valid = validation_result.get("is_valid", False)
            confidence = validation_result.get("confidence", 0)

            # Determine status based on validation
            if confidence < 30:
                status = "rejected"
            elif is_valid or confidence >= 50:
                status = "verified"
            else:
                status = "pending"

            # ✅ Resolve enum member correctly: "resume" → DocumentType.RESUME
            doc_type_enum = cls._resolve_type(document_type)

            # Create document record with file info
            document = Document(
                id=str(uuid.uuid4()),
                type=doc_type_enum,
                description=description,
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