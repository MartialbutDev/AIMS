"""Validate avatar uploads and limit the public avatar mount to raster images."""

from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps

MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_AVATAR_PIXELS = 20_000_000
AVATAR_DIMENSIONS = (1024, 1024)
UPLOAD_FORMATS = ("JPEG", "PNG", "WEBP")

# HEIC remains readable for legacy avatars. New uploads need a supported decoder.
PUBLIC_IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
}


def encode_avatar(content: bytes) -> tuple[bytes, str]:
    """Decode the actual bytes and write a new image without user metadata."""
    with Image.open(BytesIO(content), formats=UPLOAD_FORMATS) as source:
        if source.width * source.height > MAX_AVATAR_PIXELS:
            raise ValueError("Avatar has too many pixels")
        source.load()
        with ImageOps.exif_transpose(source) as oriented:
            oriented.thumbnail(AVATAR_DIMENSIONS)
            has_alpha = "A" in oriented.getbands() or "transparency" in oriented.info
            with oriented.convert("RGBA" if has_alpha else "RGB") as image:
                image.info.clear()
                output = BytesIO()
                image.save(output, format="PNG" if has_alpha else "JPEG")
                return output.getvalue(), ".png" if has_alpha else ".jpg"


class AvatarStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        media_type = PUBLIC_IMAGE_TYPES.get(Path(path).suffix.lower())
        if media_type is None:
            raise HTTPException(status_code=404)

        response = await super().get_response(path, scope)
        if response.status_code != 304:
            response.headers["Content-Type"] = media_type
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return response
