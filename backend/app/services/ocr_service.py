#receive image, run tesseract, return extracted text
#def_extract_text(image_path):
#...
#return text

import os
import shutil
import pytesseract

from fastapi import UploadFile, HTTPException
from PIL import Image
from pytesseract import TesseractError

from app.core.config import settings

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_PATH

UPLOAD_DIR = os.path.join(settings.ASSET_DIR, "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

class OCRService:
    @staticmethod
    def save_image(file:UploadFile) -> str:
        #save uploaded image and return full path

        file_path = os.path.join(UPLOAD_DIR, file.filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return file_path

    @staticmethod
    def extract_text(image_path: str) -> str:
        #read img and extract txt with tesseract
        try:
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image)
            return text
        except TesseractError as e:
            raise HTTPException(status_code=500, detail=f"Error occurred while extracting text: {e}")
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=str(e)
            )