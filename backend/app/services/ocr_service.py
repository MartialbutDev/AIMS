
"""Shared OCR utilities for uploaded images and PDF documents."""

import logging
import os
import shutil
import uuid
from pathlib import Path

import pymupdf as fitz
import pytesseract
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
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

    # Match the former onboarding fallback threshold and time limit.
    MIN_PDF_TEXT_CHARS = 40
    OCR_TIMEOUT_SECONDS = 20
    MAX_RENDER_PIXELS = 8_000_000

    @staticmethod
    def extract_header(file_path: str, file_type: str) -> str:
        """Read only the visual top 40% of page one, before content checks."""
        if file_type == 'pdf':
            with fitz.open(file_path) as document:
                if document.needs_pass or not document.page_count:
                    raise ValueError('Unreadable PDF header')
                page = document[0]
                # Text coordinates are unrotated; transform the visual header clip.
                visual = page.rect
                clip = fitz.Rect(visual.x0, visual.y0, visual.x1, visual.y0 + visual.height * 0.4)
                text = page.get_text('text', clip=clip * page.derotation_matrix, sort=True).strip()
                if len(text) >= OCRService.MIN_PDF_TEXT_CHARS:
                    return text
                area = clip.width * clip.height
                if area <= 0:
                    raise ValueError('Invalid PDF header dimensions')
                scale = min(2.0, (OCRService.MAX_RENDER_PIXELS / area) ** 0.5)
                pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip,
                                         colorspace=fitz.csRGB, alpha=False)
                with Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples) as image:
                    recognized = pytesseract.image_to_string(image, timeout=OCRService.OCR_TIMEOUT_SECONDS).strip()
                return recognized or text
        if file_type == 'image':
            with Image.open(file_path) as source, ImageOps.exif_transpose(source) as oriented:
                with oriented.crop((0, 0, oriented.width, max(1, int(oriented.height * 0.4)))) as crop:
                    with crop.convert('RGB') as image:
                        image.thumbnail((2800, 2800))
                        return pytesseract.image_to_string(image, timeout=OCRService.OCR_TIMEOUT_SECONDS).strip()
        raise ValueError('Unsupported header file type')

    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> str:
        """Read embedded text, OCRing each scanned/sparse page when needed.

        Extraction failures propagate so callers require manual review rather
        than validating a partial document after a failed page.
        """
        try:
            chunks: list[str] = []
            with fitz.open(pdf_path) as document:
                if document.needs_pass:
                    raise ValueError("Password-protected PDF")
                for page in document:
                    text = page.get_text("text").strip()
                    if len(text) < OCRService.MIN_PDF_TEXT_CHARS:
                        area = page.rect.width * page.rect.height
                        if area <= 0:
                            raise ValueError("Invalid PDF page dimensions")
                        # Render at 2x resolution, bounded for unusually large pages.
                        scale = min(2.0, (OCRService.MAX_RENDER_PIXELS / area) ** 0.5)
                        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale),
                                                 colorspace=fitz.csRGB, alpha=False)
                        with Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples) as image:
                            recognized = pytesseract.image_to_string(
                                image, timeout=OCRService.OCR_TIMEOUT_SECONDS).strip()
                        # Preserve short embedded text if a blank OCR result adds nothing.
                        text = recognized or text
                    if text:
                        chunks.append(text)
            return "\n".join(chunks).strip()
        except HTTPException:
            raise
        except (TesseractError, pytesseract.TesseractNotFoundError, RuntimeError) as exc:
            logger.exception("PDF OCR failed")
            raise HTTPException(500, "PDF OCR is unavailable, timed out or failed; manual review required") from exc
        except Exception as exc:
            logger.exception("PDF text extraction failed")
            raise HTTPException(400, "PDF text could not be extracted; manual review required") from exc

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
                    text = pytesseract.image_to_string(image, timeout=OCRService.OCR_TIMEOUT_SECONDS)
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
