"""Shared request and file size limits for document OCR endpoints."""

import re
from fastapi.responses import JSONResponse

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024  # Multipart framing and form fields.
UPLOAD_SIZE_MESSAGE = "This file exceeds the 10 MB upload limit. Choose a smaller copy."

OCR_UPLOAD_PATHS = {
    "/api/v1/documents/identify",
    "/api/v1/documents/upload",
    "/api/v1/onboarding/cor",
    "/api/v1/onboarding/orientation",
}


class DocumentUploadLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope["path"].rstrip("/")
        intake = scope["method"] == "PUT" and bool(re.fullmatch(r"/api/v1/companies/[^/]+/intake", path))
        if not intake and not (scope["method"] == "POST" and path in OCR_UPLOAD_PATHS):
            await self.app(scope, receive, send)
            return
        maximum = 5 * 1024 * 1024 + 64 * 1024 if intake else MAX_REQUEST_BYTES
        message_text = "Supporting PDF must be 5 MB or smaller." if intake else UPLOAD_SIZE_MESSAGE
        rejected = JSONResponse({"detail": message_text}, status_code=413)
        for name, value in scope["headers"]:
            if name == b"content-length":
                try:
                    if int(value) > maximum:
                        await rejected(scope, receive, send)
                        return
                except ValueError:
                    pass

        size = 0
        over_limit = False

        async def limited_receive():
            nonlocal size, over_limit
            message = await receive()
            if message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > maximum:
                    over_limit = True
                    # Starlette closes spooled multipart files on OSError.
                    raise OSError(message_text)
            return message

        async def limit_response(message):
            if not over_limit:
                await send(message)
            elif message["type"] == "http.response.start":
                await rejected(scope, receive, send)

        await self.app(scope, limited_receive, limit_response)
