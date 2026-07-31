#save uploaded file, call ocr service, verify document, save database record, return result

from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.models.document import Document
from app.services.ocr_service import OCRService

class DocumentService:

    REQUIRED_HEADERS = {
        "document": "before moving",  # change this to the actual required headers for document verification
        "transcript": "document transcript",
        "user_id": "student ID"
    }

    @classmethod
    def verify_document(cls, document_type: str, extracted_text: str):

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
    ):
        image_path = OCRService.save_image(file)
        extracted_text = OCRService.extract_text(image_path)
        verified = cls.verify_document(
            document_type,
            extracted_text
        )
        status = "verified" if verified else "rejected"

        document = Document(
            type=document_type,
            description=description,
            file_path=image_path,
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
            "document": document
        }