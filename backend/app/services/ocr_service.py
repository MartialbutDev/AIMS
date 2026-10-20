
"""Shared OCR utilities for uploaded images and PDF documents."""

import logging
import os
import shutil
import uuid
from pathlib import Path

import pymupdf as fitz
import pytesseract
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pytesseract import TesseractError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure the Tesseract executable if a custom path is supplied.
if getattr(settings, "TESSERACT_PATH", None):
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_PATH

UPLOAD_DIR = Path(settings.ASSET_DIR).resolve() / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class OCRService:
    ALLOWED_EXTENSIONS = {
        "image": [".jpg", ".jpeg", ".png", ".heic", ".bmp", ".tiff"],
        "pdf": [".pdf"],
    }

    @staticmethod
    def validate_file_type(filename: str) -> str:
        """Return 'image' or 'pdf' for an allowed filename extension."""
        extension = Path(filename or "").suffix.lower()

        for file_type, extensions in OCRService.ALLOWED_EXTENSIONS.items():
            if extension in extensions:
                return file_type

        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: JPG, JPEG, PNG, HEIC, BMP, TIFF, PDF",
        )

    @staticmethod
    def save_file(file: UploadFile) -> tuple[str, str]:
        """Save an upload and return (relative_path, file_type).

        This synchronous method is retained for compatibility with existing callers.
        """
        file_type = OCRService.validate_file_type(file.filename or "")
        extension = Path(file.filename or "").suffix.lower()
        destination = UPLOAD_DIR / f"{uuid.uuid4().hex}{extension}"

        try:
            with destination.open("wb") as output:
                shutil.copyfileobj(file.file, output)

            relative_path = f"uploads/{destination.name}"
            logger.info("Saved OCR upload to %s", destination)
            return relative_path, file_type

        except Exception as exc:
            destination.unlink(missing_ok=True)
            logger.exception("Failed to save OCR upload")
            raise HTTPException(
                status_code=500,
                detail="Unable to save uploaded file",
            ) from exc

    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> str:
        """Extract embedded text from a PDF using PyMuPDF."""
        try:
            logger.info("Extracting PDF text: %s", pdf_path)
            chunks: list[str] = []

            with fitz.open(pdf_path) as document:
                for page_number, page in enumerate(document, start=1):
                    page_text = page.get_text("text")
                    if page_text.strip():
                        chunks.append(f"--- Page {page_number} ---\n{page_text}")

            text = "\n".join(chunks).strip()
            logger.info("PDF text extracted: %d characters", len(text))
            return text

        except Exception:
            logger.exception("PDF text extraction failed: %s", pdf_path)
            # Preserve the previous service contract: failed extraction yields no text.
            return ""

    @staticmethod
    def extract_text_from_image(image_path: str) -> str:
        """Extract text from an image using Tesseract OCR."""
        if not os.path.isfile(image_path):
            raise HTTPException(status_code=404, detail="Image file not found")

        try:
            logger.info("Extracting image text: %s", image_path)

            with Image.open(image_path) as source:
                image = source.convert("RGB")
                try:
                    text = pytesseract.image_to_string(image)
                finally:
                    image.close()

            logger.info("Image text extracted: %d characters", len(text))
            return text.strip()

        except (TesseractError, pytesseract.TesseractNotFoundError) as exc:
            logger.exception("Tesseract OCR failed")
            raise HTTPException(
                status_code=500,
                detail="Tesseract OCR is unavailable or failed",
            ) from exc
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            logger.exception("Image decoding failed")
            raise HTTPException(
                status_code=400,
                detail="Image cannot be opened or decoded",
            ) from exc
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Image OCR failed")
            raise HTTPException(
                status_code=500,
                detail="Unable to extract text from image",
            ) from exc

    @staticmethod
    def extract_text(file_path: str, file_type: str | None = None) -> str:
        """Dispatch text extraction based on file type or extension."""
        if file_type is None:
            file_type = "pdf" if file_path.lower().endswith(".pdf") else "image"

        if file_type == "pdf":
            return OCRService.extract_text_from_pdf(file_path)

        if file_type == "image":
            return OCRService.extract_text_from_image(file_path)

        raise HTTPException(status_code=400, detail="Unsupported OCR file type")
