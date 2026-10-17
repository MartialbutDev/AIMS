# backend/app/services/document_service.py
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException
import re
import uuid
import os

from app.models.document import Document, DocumentType
from app.models.user import User
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
    REJECT_THRESHOLD,
    VERIFY_THRESHOLD,
)
from app.services.notification_service import NotificationService


# ----------------------------------------------------------------
# Fuzzy matching helpers
# ----------------------------------------------------------------

def _edit_distance_one(a: str, b: str) -> bool:
    """Return True if `a` and `b` differ by at most 1 edit."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False

    if len(a) == len(b):
        return sum(1 for x, y in zip(a, b) if x != y) <= 1

    longer, shorter = (a, b) if len(a) > len(b) else (b, a)
    i = j = 0
    diff = 0
    while i < len(longer) and j < len(shorter):
        if longer[i] != shorter[j]:
            diff += 1
            if diff > 1:
                return False
            i += 1
        else:
            i += 1
            j += 1
    return diff + (len(longer) - i) <= 1


def _fuzzy_contains(text_upper: str, word: str) -> bool:
    """True if `word` appears in `text_upper` allowing 1-char OCR errors."""
    if not word or len(word) < 4:
        return False

    if word in text_upper:
        return True

    n = len(word)
    for i in range(len(text_upper) - n + 1):
        window = text_upper[i:i + n]
        if _edit_distance_one(word, window):
            return True

    return False


class DocumentService:

    VALIDATION_FUNCTIONS = {
        "resume": validate_resume,
        "application_letter": validate_application_letter,
        "waiver": validate_waiver,
        "medical_certificate": validate_medical_certificate,
        "internship_plan": validate_internship_plan,
        "insurance": validate_insurance,
        "endorsement_letter": validate_endorsement_letter,
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

    _TYPE_LABELS = {
        DocumentType.RESUME: "Resume/CV",
        DocumentType.APPLICATION_LETTER: "Application Letter",
        DocumentType.WAIVER: "Waiver / Consent",
        DocumentType.MEDICAL_CERTIFICATE: "Medical Certificate",
        DocumentType.INTERNSHIP_PLAN: "Internship Plan",
        DocumentType.INSURANCE: "Insurance",
        DocumentType.ENDORSEMENT_LETTER: "Endorsement Letter",
        DocumentType.ACCEPTANCE_LETTER: "Acceptance Letter",
        DocumentType.CERTIFICATE_OF_COMPLETION: "Certificate of Completion",
        DocumentType.REQUIREMENTS: "Requirements",
        DocumentType.DOCUMENT: "Document",
        DocumentType.TRANSCRIPT: "Transcript",
        DocumentType.USER_ID: "ID Document",
    }

    # ------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------

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
                "thresholds": {"reject": REJECT_THRESHOLD, "verify": VERIFY_THRESHOLD},
            }

        return validation_func(extracted_text)

    @classmethod
    def _name_match_bonus(
        cls,
        extracted_text: str,
        first_name: str,
        last_name: str,
    ) -> tuple[int, dict]:
        """Return (bonus, info). +25 if both names match, else +0."""
        info = {
            "first_match": False,
            "last_match": False,
            "first_exact": False,
            "last_exact": False,
            "bonus": 0,
        }

        if not extracted_text or not first_name or not last_name:
            return 0, info

        text_upper = extracted_text.upper()

        def clean(s: str) -> str:
            return re.sub(r"[^A-Z]", "", (s or "").upper())

        first = clean(first_name)
        last = clean(last_name)

        first_ok = len(first) >= 4
        last_ok = len(last) >= 4

        first_exact = first_ok and first in text_upper
        last_exact = last_ok and last in text_upper

        first_match = first_exact or (first_ok and _fuzzy_contains(text_upper, first))
        last_match = last_exact or (last_ok and _fuzzy_contains(text_upper, last))

        bonus = 25 if (first_match and last_match) else 0

        info.update(
            first_match=first_match,
            last_match=last_match,
            first_exact=first_exact,
            last_exact=last_exact,
            bonus=bonus,
        )
        return bonus, info

    @classmethod
    def _fire_document_notification(
        cls,
        db: Session,
        user_id: str,
        document_id: str,
        status: str,
        doc_type_enum: DocumentType,
    ) -> None:
        """Fire a document notification to the uploader. Never raises."""
        try:
            type_label = cls._TYPE_LABELS.get(doc_type_enum, "Document")
            NotificationService.create_document_notification(
                db=db,
                user_id=user_id,
                document_id=document_id,
                status=status,
                doc_type=type_label,
            )
        except Exception as e:
            print(f"⚠️ Failed to create document notification: {e}")

    @classmethod
    def _serialize_document(cls, document: Document) -> dict:
        """
        Build a plain dict from the ORM document with primitive values only.
        This guarantees `document.id` and every other field survives FastAPI's
        response serialization — no ORM lazy-loading, no missing attributes.
        """
        # type: enum → string
        type_value = (
            document.type.value
            if hasattr(document.type, "value")
            else str(document.type)
        )

        return {
            "id": document.id,
            "type": type_value,
            "description": document.description,
            "original_filename": document.original_filename,
            "file_path": document.file_path,
            "verification_status": document.verification_status,
            "extracted_text": document.extracted_text,
            "validation_confidence": document.validation_confidence,
            "validation_message": document.validation_message,
            "created_at": (
                document.created_at.isoformat()
                if document.created_at
                else None
            ),
            "updated_at": (
                document.updated_at.isoformat()
                if document.updated_at
                else None
            ),
        }

    # ------------------------------------------------------------
    # Upload
    # ------------------------------------------------------------

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

            # ----- Keyword validation -----
            validation_result = cls.verify_document(document_type, extracted_text)
            base_confidence = validation_result.get("confidence", 0)
            is_keyword_valid = validation_result.get("is_valid", False)

            # ----- Name-match bonus -----
            uploader = db.query(User).filter(User.id == uploaded_by).first()
            name_bonus = 0
            name_info = {
                "first_match": False,
                "last_match": False,
                "first_exact": False,
                "last_exact": False,
                "bonus": 0,
            }

            if uploader and uploader.first_name and uploader.last_name:
                name_bonus, name_info = cls._name_match_bonus(
                    extracted_text=extracted_text,
                    first_name=uploader.first_name,
                    last_name=uploader.last_name,
                )

            # ----- Final confidence -----
            confidence = min(100, base_confidence + name_bonus)

            # ----- Text length gate -----
            text_len = len((extracted_text or "").strip())

            # ----- Three-tier status -----
            if text_len < 100 or not is_keyword_valid or confidence < REJECT_THRESHOLD:
                status = "rejected"
            elif confidence >= VERIFY_THRESHOLD:
                status = "verified"
            else:
                status = "pending"

            # ----- Build message -----
            base_message = validation_result.get("message", "")
            parts = [base_message]

            if name_bonus:
                match_type = []
                if name_info.get("first_exact"):
                    match_type.append("first: exact")
                elif name_info.get("first_match"):
                    match_type.append("first: fuzzy")
                if name_info.get("last_exact"):
                    match_type.append("last: exact")
                elif name_info.get("last_match"):
                    match_type.append("last: fuzzy")

                parts.append(
                    f"👤 Name match +{name_bonus}% ({', '.join(match_type)})"
                )
            elif name_info.get("first_match") or name_info.get("last_match"):
                which = []
                if name_info.get("first_match"):
                    which.append("first name")
                if name_info.get("last_match"):
                    which.append("last name")
                parts.append(
                    f"⚠️ Partial name match ({', '.join(which)}) — no bonus awarded"
                )

            if status == "pending":
                parts.append(
                    f"⏳ Confidence {confidence}% is between "
                    f"{REJECT_THRESHOLD}% and {VERIFY_THRESHOLD}% — queued for manual review."
                )

            final_message = " ".join(parts)

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
                validation_message=final_message,
            )

            db.add(document)
            db.commit()
            db.refresh(document)

            # ✅ Fire document notification
            cls._fire_document_notification(
                db=db,
                user_id=uploaded_by,
                document_id=document.id,
                status=status,
                doc_type_enum=doc_type_enum,
            )

            # ✅ Explicitly serialize the document — this guarantees document.id
            #    is present in the response regardless of FastAPI's model coercion
            return {
                "verified": status == "verified",
                "status": status,
                "document": cls._serialize_document(document),
                "extracted_text": extracted_text[:500],
                "file_type": file_type,
                "validation": {
                    **validation_result,
                    "confidence": confidence,
                    "base_confidence": base_confidence,
                    "name_bonus": name_bonus,
                    "name_info": name_info,
                    "message": final_message,
                },
            }

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error uploading document: {str(e)}",
            )