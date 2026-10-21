
"""
AIMS Hybrid Automated Document Validation.

Workflow:
1. Save uploaded document
2. Extract OCR text
3. Apply document-specific rule validation
4. Check registered student name
5. Automatically verify eligible documents that pass
6. Send other documents for coordinator review
7. Save results and notify student

Does not modify COR / Orientation onboarding.
"""

import os
import re
import uuid
import logging

from typing import Any

from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException

from app.models.document import (
    Document,
    DocumentType,
)

from app.models.user import User

from app.services.ocr_service import OCRService
from app.services.notification_service import NotificationService

from app.core.config import settings

from app.utils.document_keywords import (
    validate_resume,
    validate_application_letter,
    validate_endorsement_letter,
    validate_acceptance_letter,
    validate_certificate_of_completion,
    validate_generic_document,
    validate_waiver,
    validate_medical_certificate,
    validate_internship_plan,
    validate_insurance,
    REJECT_THRESHOLD,
    VERIFY_THRESHOLD,
)


logger = logging.getLogger(__name__)


# ============================================================
# NAME MATCHING HELPERS
# ============================================================

def _edit_distance_one(a: str, b: str) -> bool:
    """
    Return True when two strings differ by
    at most one character edit.
    """

    if a == b:
        return True

    if abs(len(a) - len(b)) > 1:
        return False

    if len(a) == len(b):
        return sum(
            x != y
            for x, y in zip(a, b)
        ) <= 1

    longer, shorter = (
        (a, b)
        if len(a) > len(b)
        else (b, a)
    )

    i = 0
    j = 0
    errors = 0

    while i < len(longer) and j < len(shorter):

        if longer[i] == shorter[j]:
            i += 1
            j += 1
            continue

        errors += 1

        if errors > 1:
            return False

        i += 1

    return (
        errors + len(longer) - i
    ) <= 1


def _name_tokens(value: str) -> list[str]:
    """
    Split names into tokens.

    Very short tokens are ignored to avoid
    matching common words and initials.
    """

    return [
        token
        for token in re.findall(
            r"[A-Z]+",
            (value or "").upper(),
        )
        if len(token) >= 3
    ]


def _fuzzy_contains(
    text_upper: str,
    word: str,
) -> bool:
    """
    Find a name token with one OCR error allowed.

    Used for review guidance only.
    Fuzzy matches do not qualify for auto-verification.
    """

    if len(word) < 4:
        return False

    tokens = re.findall(
        r"[A-Z]+",
        text_upper[:30000],
    )

    return any(
        _edit_distance_one(word, token)
        for token in tokens
        if abs(len(token) - len(word)) <= 1
    )


# ============================================================
# DOCUMENT SERVICE
# ============================================================

class DocumentService:

    # Only student-generated documents can qualify
    # for automatic CONTENT verification.
    #
    # External/official documents always require
    # coordinator review.
    AUTO_VERIFY_TYPES = {
        "resume",
        "application_letter",
        "internship_plan",
    }

    VALIDATION_FUNCTIONS = {
        "resume": validate_resume,
        "application_letter": validate_application_letter,
        "waiver": validate_waiver,
        "medical_certificate": validate_medical_certificate,
        "internship_plan": validate_internship_plan,
        "insurance": validate_insurance,
        "endorsement_letter": validate_endorsement_letter,
        "acceptance_letter": validate_acceptance_letter,
        "certificate_of_completion": validate_certificate_of_completion,
        "requirements": validate_generic_document,
        "document": validate_generic_document,
        "transcript": validate_generic_document,
        "user_id": validate_generic_document,
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

    # ========================================================
    # RESOLVE DOCUMENT TYPE
    # ========================================================

    @classmethod
    def _resolve_type(
        cls,
        document_type: str,
    ) -> DocumentType:

        key = (
            document_type or ""
        ).strip().lower()

        member_name = (
            cls._TYPE_ALIASES.get(key)
            or key.upper()
        )

        try:
            return DocumentType[member_name]

        except KeyError:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unsupported document_type: "
                    f"{document_type}"
                ),
            )

    # ========================================================
    # DOCUMENT-SPECIFIC VALIDATION
    # ========================================================

    @classmethod
    def verify_document(
        cls,
        document_type: str,
        extracted_text: str,
    ) -> dict:

        key = (
            document_type or ""
        ).strip().lower()

        validator = (
            cls.VALIDATION_FUNCTIONS.get(key)
        )

        if validator is None:
            return {
                "is_valid": False,
                "confidence": 0,
                "message": (
                    "Unsupported document validation "
                    f"type: {document_type}"
                ),
                "found_sections": [],
                "score": 0,
                "total_sections": 0,
                "thresholds": {
                    "reject": REJECT_THRESHOLD,
                    "verify": VERIFY_THRESHOLD,
                },
                "requires_manual_review": True,
            }

        return validator(extracted_text)

    # ========================================================
    # STUDENT NAME MATCHING
    # ========================================================

    @classmethod
    def _name_match_bonus(
        cls,
        extracted_text: str,
        first_name: str,
        last_name: str,
    ) -> tuple[int, dict]:
        """
        Compatibility method.

        Returns the legacy bonus indicator and match
        information, but the bonus is NOT added to
        the document's validation confidence.
        """

        info = {
            "first_match": False,
            "last_match": False,
            "first_exact": False,
            "last_exact": False,
            "bonus": 0,
        }

        if (
            not extracted_text
            or not first_name
            or not last_name
        ):
            return 0, info

        upper = extracted_text.upper()

        text_tokens = set(
            re.findall(
                r"[A-Z]+",
                upper,
            )
        )

        first_tokens = _name_tokens(
            first_name
        )

        last_tokens = _name_tokens(
            last_name
        )

        if not first_tokens or not last_tokens:
            return 0, info

        # Require every meaningful component
        # of the registered name.
        first_exact = all(
            token in text_tokens
            for token in first_tokens
        )

        last_exact = all(
            token in text_tokens
            for token in last_tokens
        )

        # Fuzzy matches are for review guidance only.
        first_match = (
            first_exact
            or all(
                _fuzzy_contains(upper, token)
                for token in first_tokens
            )
        )

        last_match = (
            last_exact
            or all(
                _fuzzy_contains(upper, token)
                for token in last_tokens
            )
        )

        legacy_bonus = (
            25
            if first_match and last_match
            else 0
        )

        info.update(
            first_match=first_match,
            last_match=last_match,
            first_exact=first_exact,
            last_exact=last_exact,
            bonus=legacy_bonus,
        )

        return legacy_bonus, info

    # ========================================================
    # AUTOMATIC VERIFICATION ELIGIBILITY
    # ========================================================

    @classmethod
    def _can_auto_verify(
        cls,
        document_type: str,
        validation_result: dict,
        extracted_text: str,
        name_info: dict,
    ) -> bool:
        """
        A document qualifies only if ALL gates pass.

        1. Eligible document type
        2. Readable OCR text
        3. Required content detected
        4. Content score >= 80
        5. Exact first and last name matches

        These checks do not establish authenticity.
        """

        if document_type not in cls.AUTO_VERIFY_TYPES:
            return False

        text_length = len(
            (extracted_text or "").strip()
        )

        if text_length < 120:
            return False

        if not validation_result.get(
            "is_valid",
            False,
        ):
            return False

        confidence = int(
            validation_result.get(
                "confidence",
                0,
            )
        )

        if confidence < VERIFY_THRESHOLD:
            return False

        if not name_info.get(
            "first_exact",
            False,
        ):
            return False

        if not name_info.get(
            "last_exact",
            False,
        ):
            return False

        return True

    # ========================================================
    # DETERMINE FINAL DOCUMENT STATUS
    # ========================================================

    @classmethod
    def _determine_status(
        cls,
        document_type: str,
        validation_result: dict,
        extracted_text: str,
        name_info: dict,
    ) -> tuple[str, str]:

        # Official/external documents always
        # require coordinator approval.
        if document_type not in cls.AUTO_VERIFY_TYPES:
            return (
                "pending",
                "Official or non-automated document type; "
                "coordinator review required.",
            )

        if cls._can_auto_verify(
            document_type=document_type,
            validation_result=validation_result,
            extracted_text=extracted_text,
            name_info=name_info,
        ):
            return (
                "verified",
                "Automatically content-validated using "
                "OCR, document-specific rules, and "
                "exact registered student name matching.",
            )

        text_length = len(
            (extracted_text or "").strip()
        )

        if text_length < 120:
            reason = (
                "OCR extracted insufficient readable text."
            )

        elif not validation_result.get(
            "is_valid",
            False,
        ):
            reason = (
                "Required document content was not "
                "fully detected."
            )

        elif not (
            name_info.get("first_exact")
            and name_info.get("last_exact")
        ):
            reason = (
                "Student identity could not be "
                "exactly matched."
            )

        else:
            reason = (
                "Automatic validation conditions "
                "were not satisfied."
            )

        return (
            "pending",
            reason + " Coordinator review required.",
        )

    # ========================================================
    # NOTIFICATION HELPER
    # ========================================================

    @classmethod
    def _fire_document_notification(
        cls,
        db: Session,
        user_id: str,
        document_id: str,
        status: str,
        doc_type_enum: DocumentType,
    ) -> None:

        try:
            type_label = cls._TYPE_LABELS.get(
                doc_type_enum,
                "Document",
            )

            NotificationService.create_document_notification(
                db=db,
                user_id=user_id,
                document_id=document_id,
                status=status,
                doc_type=type_label,
            )

        except Exception:
            logger.exception(
                "Failed to create document notification"
            )
            db.rollback()

    # ========================================================
    # SERIALIZATION
    # ========================================================

    @classmethod
    def _serialize_document(
        cls,
        document: Document,
    ) -> dict:

        type_value = (
            document.type.value
            if hasattr(document.type, "value")
            else str(document.type)
        )

        return {
            "id": document.id,
            "type": type_value,
            "description": document.description,
            "original_filename": (
                document.original_filename
            ),
            "file_path": document.file_path,
            "verification_status": (
                document.verification_status
            ),
            "extracted_text": (
                document.extracted_text
            ),
            "validation_confidence": (
                document.validation_confidence
            ),
            "validation_message": (
                document.validation_message
            ),
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

    # ========================================================
    # UPLOAD DOCUMENT
    # ========================================================

    @classmethod
    def upload_document(
        cls,
        db: Session,
        file: UploadFile,
        document_type: str,
        description: str,
        uploaded_by: str,
    ) -> dict:

        saved_path = None
        committed = False

        try:
            # Validate document type before saving.
            doc_type_enum = cls._resolve_type(
                document_type
            )

            type_key = doc_type_enum.value

            original_filename = (
                (file.filename or "").strip()
                or None
            )

            # --------------------------------------------
            # STEP 1: SAVE FILE
            # --------------------------------------------

            relative_path, file_type = (
                OCRService.save_file(file)
            )

            saved_path = os.path.join(
                settings.ASSET_DIR,
                relative_path,
            )

            # --------------------------------------------
            # STEP 2: OCR EXTRACTION
            # --------------------------------------------

            ocr_error = None

            try:
                extracted_text = (
                    OCRService.extract_text(
                        saved_path,
                        file_type,
                    )
                    or ""
                )

            except Exception as exc:
                # Preserve the upload for manual review.
                extracted_text = ""

                ocr_error = (
                    "OCR extraction failed; "
                    "manual review required."
                )

                logger.warning(
                    "OCR failed for %s: %s",
                    relative_path,
                    exc,
                )

            # --------------------------------------------
            # STEP 3: RULE-BASED VALIDATION
            # --------------------------------------------

            validation_result = cls.verify_document(
                type_key,
                extracted_text,
            )

            confidence = int(
                validation_result.get(
                    "confidence",
                    0,
                )
            )

            # --------------------------------------------
            # STEP 4: STUDENT NAME MATCHING
            # --------------------------------------------

            uploader = (
                db.query(User)
                .filter(
                    User.id == uploaded_by
                )
                .first()
            )

            name_bonus = 0

            name_info = {
                "first_match": False,
                "last_match": False,
                "first_exact": False,
                "last_exact": False,
                "bonus": 0,
            }

            if (
                uploader
                and uploader.first_name
                and uploader.last_name
            ):
                name_bonus, name_info = (
                    cls._name_match_bonus(
                        extracted_text=extracted_text,
                        first_name=uploader.first_name,
                        last_name=uploader.last_name,
                    )
                )

            # --------------------------------------------
            # STEP 5: AUTOMATIC OR MANUAL VALIDATION
            # --------------------------------------------

            status, decision_message = (
                cls._determine_status(
                    document_type=type_key,
                    validation_result=validation_result,
                    extracted_text=extracted_text,
                    name_info=name_info,
                )
            )

            # --------------------------------------------
            # STEP 6: BUILD VALIDATION MESSAGE
            # --------------------------------------------

            message_parts = [
                validation_result.get(
                    "message",
                    ""
                ),
            ]

            if ocr_error:
                message_parts.append(
                    ocr_error
                )

            if (
                name_info.get("first_exact")
                and name_info.get("last_exact")
            ):
                message_parts.append(
                    "Student name matched exactly."
                )

            elif (
                name_info.get("first_match")
                and name_info.get("last_match")
            ):
                message_parts.append(
                    "Student name approximately matched; "
                    "manual review required."
                )

            elif (
                name_info.get("first_match")
                or name_info.get("last_match")
            ):
                message_parts.append(
                    "Partial student name detected."
                )

            else:
                message_parts.append(
                    "Student name not confirmed by OCR."
                )

            message_parts.append(
                decision_message
            )

            final_message = " ".join(
                part
                for part in message_parts
                if part
            )

            # --------------------------------------------
            # STEP 7: SAVE DOCUMENT
            # --------------------------------------------

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

            committed = True

            db.refresh(document)

            # --------------------------------------------
            # STEP 8: NOTIFY STUDENT
            # --------------------------------------------

            cls._fire_document_notification(
                db=db,
                user_id=uploaded_by,
                document_id=document.id,
                status=status,
                doc_type_enum=doc_type_enum,
            )

            # --------------------------------------------
            # STEP 9: RETURN EXISTING RESPONSE FORMAT
            # --------------------------------------------

            return {
                "verified": status == "verified",
                "status": status,
                "document": (
                    cls._serialize_document(document)
                ),
                "extracted_text": (
                    extracted_text[:500]
                ),
                "file_type": file_type,
                "validation": {
                    **validation_result,
                    "confidence": confidence,
                    "base_confidence": confidence,
                    "name_bonus": 0,
                    "legacy_name_bonus": name_bonus,
                    "name_info": name_info,
                    "message": final_message,
                    "requires_manual_review": (
                        status == "pending"
                    ),
                    "automatically_verified": (
                        status == "verified"
                    ),
                    "validation_method": (
                        "ocr_rule_based"
                    ),
                    "ocr_error": ocr_error,
                },
            }

        except HTTPException:
            db.rollback()

            if saved_path and not committed:
                try:
                    os.remove(saved_path)
                except OSError:
                    pass

            raise

        except Exception:
            db.rollback()

            if saved_path and not committed:
                try:
                    os.remove(saved_path)
                except OSError:
                    pass

            logger.exception(
                "Document upload failed"
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to process document upload."
                ),
            )
