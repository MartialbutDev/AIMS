"""Shared request and file size limits for document OCR endpoints."""

from fastapi.responses import JSONResponse

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024  # Multipart framing and form fields.
UPLOAD_SIZE_MESSAGE = "Document must be 10 MB or smaller."

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
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or scope["path"].rstrip("/") not in OCR_UPLOAD_PATHS
        ):
            await self.app(scope, receive, send)
            return

        rejected = JSONResponse({"detail": UPLOAD_SIZE_MESSAGE}, status_code=413)
        for name, value in scope["headers"]:
            if name == b"content-length":
                try:
                    if int(value) > MAX_REQUEST_BYTES:
                        await rejected(scope, receive, send)
                        return
                except ValueError:
                    pass  # The streamed byte count is still enforced below.

        size = 0
        over_limit = False

        async def limited_receive():
            nonlocal size, over_limit
            message = await receive()
            if message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > MAX_REQUEST_BYTES:
                    over_limit = True
                    # Starlette closes spooled multipart files on OSError.
                    raise OSError(UPLOAD_SIZE_MESSAGE)
            return message

        async def limit_response(message):
            if not over_limit:
                await send(message)
            elif message["type"] == "http.response.start":
                await rejected(scope, receive, send)

        await self.app(scope, limited_receive, limit_response)
