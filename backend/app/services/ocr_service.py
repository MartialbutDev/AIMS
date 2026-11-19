
"""Shared OCR utilities for uploaded images and PDF documents."""

import logging
import os
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path
from time import monotonic

import pymupdf as fitz
import pytesseract
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import TesseractError

from app.core.config import settings
from app.core.file_storage import staged_file
from app.core.document_upload_limits import MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE

logger = logging.getLogger(__name__)

# Configure the Tesseract executable if a custom path is supplied.
if getattr(settings, "TESSERACT_PATH", None):
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_PATH

UPLOAD_DIR = Path(settings.ASSET_DIR).resolve() / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


MAX_PDF_PAGES = 6
MAX_IMAGE_PIXELS = 20_000_000
MAX_IMAGE_DIMENSION = 10_000
OCR_DOCUMENT_SECONDS = 30
OCR_TIMEOUT_MESSAGE = "Text recognition took too long. Upload a smaller file or a PDF with selectable text."
_deadline: ContextVar[float | None] = ContextVar("ocr_deadline", default=None)


class DocumentLimitError(HTTPException):
    """A document limit must stop the upload rather than trigger manual review."""


def _remaining_time() -> float:
    deadline = _deadline.get()
    remaining = deadline - monotonic() if deadline is not None else OCR_DOCUMENT_SECONDS
    if remaining <= 0:
        raise DocumentLimitError(422, OCR_TIMEOUT_MESSAGE)
    return remaining


@contextmanager
def ocr_budget():
    """Share the deadline across the header and all pages of one document."""
    if _deadline.get() is not None:
        yield
        return
    token = _deadline.set(monotonic() + OCR_DOCUMENT_SECONDS)
    try:
        yield
    finally:
        _deadline.reset(token)


def check_pdf_limits(document) -> None:
    if document.page_count > MAX_PDF_PAGES:
        raise DocumentLimitError(413, f"PDFs must contain no more than {MAX_PDF_PAGES} pages.")


def check_image_limits(image: Image.Image) -> None:
    if max(image.size) > MAX_IMAGE_DIMENSION or image.width * image.height > MAX_IMAGE_PIXELS:
        raise DocumentLimitError(413, "Images must be at most 20 megapixels and 10,000 pixels on each side.")


def _render_scale(width: float, height: float) -> float:
    if width <= 0 or height <= 0:
        raise ValueError("Invalid PDF page dimensions")
    # Leave room for pixel rounding and cap unusually long, narrow pages.
    return min(2.0, (7_980_000 / (width * height)) ** 0.5, 4000 / max(width, height))


def _recognize(image: Image.Image) -> str:
    try:
        text = pytesseract.image_to_string(image, timeout=min(OCRService.OCR_TIMEOUT_SECONDS, _remaining_time()))
    except RuntimeError as exc:
        if str(exc) == "Tesseract process timeout":
            raise DocumentLimitError(422, OCR_TIMEOUT_MESSAGE) from exc
        raise
    _remaining_time()
    return text.strip()


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
            size = 0
            with staged_file(destination) as output:
                while chunk := file.file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_UPLOAD_BYTES:
                        raise DocumentLimitError(413, UPLOAD_SIZE_MESSAGE)
                    output.write(chunk)
            if size == 0:
                raise HTTPException(400, "Uploaded file is empty.")

            relative_path = f"uploads/{destination.name}"
            logger.info("Saved OCR upload to %s", destination)
            return relative_path, file_type

        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to save OCR upload")
            raise HTTPException(
                status_code=500,
                detail="Unable to save uploaded file",
            ) from exc

    # Match the former onboarding fallback threshold and time limit.
    MIN_PDF_TEXT_CHARS = 40
    OCR_TIMEOUT_SECONDS = 20

    @staticmethod
    @ocr_budget()
    def extract_header(file_path: str, file_type: str) -> str:
        """Read only the visual top 40% of page one, before content checks."""
        if file_type == 'pdf':
            with fitz.open(file_path) as document:
                check_pdf_limits(document)
                if document.needs_pass or not document.page_count:
                    raise ValueError('Unreadable PDF header')
                page = document[0]
                # Text coordinates are unrotated; transform the visual header clip.
                visual = page.rect
                clip = fitz.Rect(visual.x0, visual.y0, visual.x1, visual.y0 + visual.height * 0.4)
                text = page.get_text('text', clip=clip * page.derotation_matrix, sort=True).strip()
                _remaining_time()
                if len(text) >= OCRService.MIN_PDF_TEXT_CHARS:
                    return text
                scale = _render_scale(clip.width, clip.height)
                pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip,
                                         colorspace=fitz.csRGB, alpha=False)
                with Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples) as image:
                    recognized = _recognize(image)
                return recognized or text
        if file_type == 'image':
            try:
                with Image.open(file_path) as source:
                    check_image_limits(source)
                    with ImageOps.exif_transpose(source) as oriented:
                        with oriented.crop((0, 0, oriented.width, max(1, int(oriented.height * 0.4)))) as crop:
                            with crop.convert("RGB") as image:
                                image.thumbnail((2800, 2800))
                                return _recognize(image)
            except Image.DecompressionBombError as exc:
                raise DocumentLimitError(413, "Image exceeds the allowed dimensions.") from exc
        raise ValueError('Unsupported header file type')

    @staticmethod
    @ocr_budget()
    def extract_text_from_pdf(pdf_path: str) -> str:
        """Read embedded text, OCRing each scanned/sparse page when needed.

        Extraction failures propagate so callers require manual review rather
        than validating a partial document after a failed page.
        """
        try:
            chunks: list[str] = []
            with fitz.open(pdf_path) as document:
                check_pdf_limits(document)
                if document.needs_pass:
                    raise ValueError("Password-protected PDF")
                for page in document:
                    _remaining_time()
                    # Use visual reading order rather than PDF object insertion order.
                    text = page.get_text("text", sort=True).strip()
                    _remaining_time()
                    if len(text) < OCRService.MIN_PDF_TEXT_CHARS:
                        scale = _render_scale(page.rect.width, page.rect.height)
                        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale),
                                                 colorspace=fitz.csRGB, alpha=False)
                        with Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples) as image:
                            recognized = _recognize(image)
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
    @ocr_budget()
    def extract_text_from_image(image_path: str) -> str:
        """Extract text from an image using Tesseract OCR."""
        if not os.path.isfile(image_path):
            raise HTTPException(status_code=404, detail="Image file not found")

        try:
            logger.info("Extracting image text: %s", image_path)

            with Image.open(image_path) as source:
                check_image_limits(source)
                with ImageOps.exif_transpose(source) as oriented, oriented.convert("RGB") as image:
                    image.thumbnail((2800, 2800))
                    text = _recognize(image)

            logger.info("Image text extracted: %d characters", len(text))
            return text.strip()

        except (TesseractError, pytesseract.TesseractNotFoundError) as exc:
            logger.exception("Tesseract OCR failed")
            raise HTTPException(
                status_code=500,
                detail="Tesseract OCR is unavailable or failed",
            ) from exc
        except Image.DecompressionBombError as exc:
            raise DocumentLimitError(413, "Image exceeds the allowed dimensions.") from exc
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
