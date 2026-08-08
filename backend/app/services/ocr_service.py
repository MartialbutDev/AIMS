import os
import shutil
import pytesseract
from fastapi import UploadFile, HTTPException
from PIL import Image
from pytesseract import TesseractError
import uuid
import logging
import fitz  # PyMuPDF for PDF handling

from app.core.config import settings

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set Tesseract path
pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_PATH

# Create upload directory
UPLOAD_DIR = os.path.join(settings.ASSET_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class OCRService:
    
    ALLOWED_EXTENSIONS = {
        "image": [".jpg", ".jpeg", ".png", ".heic", ".bmp", ".tiff"],
        "pdf": [".pdf"],
    }
    
    @staticmethod
    def validate_file_type(filename: str) -> str:
        """Validate file extension and return file type"""
        ext = os.path.splitext(filename)[1].lower()
        for file_type, extensions in OCRService.ALLOWED_EXTENSIONS.items():
            if ext in extensions:
                return file_type
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: JPG, PNG, HEIC, PDF"
        )

    @staticmethod
    def save_file(file: UploadFile) -> tuple:
        """Save uploaded file and return (relative_path, file_type)"""
        try:
            logger.info(f"Saving file: {file.filename}")
            
            # Validate file type
            file_type = OCRService.validate_file_type(file.filename)
            
            # Generate unique filename
            file_extension = os.path.splitext(file.filename)[1].lower()
            filename = f"{uuid.uuid4()}{file_extension}"
            
            # Full path for saving the file
            full_path = os.path.join(UPLOAD_DIR, filename)
            
            logger.info(f"Full path: {full_path}")

            # Save file
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            logger.info(f"File saved successfully: {full_path}")
            
            # Return relative path and file type
            relative_path = f"uploads/{filename}"
            logger.info(f"Relative path stored in DB: {relative_path}")
            return relative_path, file_type
            
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")

    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> str:
        """Extract text from PDF using PyMuPDF"""
        try:
            logger.info(f"Extracting text from PDF: {pdf_path}")
            doc = fitz.open(pdf_path)
            text = ""
            for page_num, page in enumerate(doc):
                page_text = page.get_text()
                if page_text:
                    text += f"--- Page {page_num + 1} ---\n{page_text}\n"
            doc.close()
            logger.info(f"PDF extracted: {len(text)} characters")
            return text.strip()
        except Exception as e:
            logger.error(f"PDF extraction error: {str(e)}")
            return ""

    @staticmethod
    def extract_text_from_image(image_path: str) -> str:
        """Extract text from image using Tesseract OCR"""
        try:
            logger.info(f"Extracting text from image: {image_path}")
            
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"File not found: {image_path}")
            
            # Open image
            image = Image.open(image_path)
            logger.info(f"Image opened: {image.size}, mode: {image.mode}")
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Extract text
            text = pytesseract.image_to_string(image)
            logger.info(f"Text extracted: {len(text)} characters")
            return text.strip()
        except TesseractError as e:
            logger.error(f"OCR Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"OCR Error: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

    @staticmethod
    def extract_text(file_path: str, file_type: str = None) -> str:
        """Extract text from file based on type"""
        if file_type is None:
            # Auto-detect from extension
            if file_path.lower().endswith('.pdf'):
                file_type = "pdf"
            else:
                file_type = "image"
        
        if file_type == "pdf":
            return OCRService.extract_text_from_pdf(file_path)
        else:
            return OCRService.extract_text_from_image(file_path)