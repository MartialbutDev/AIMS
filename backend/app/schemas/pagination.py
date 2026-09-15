# backend/app/schemas/pagination.py
"""
Generic paginated response envelope.

Usage:
    @router.get("/", response_model=PaginatedResponse[ApplicationResponse])
    async def list_items(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=100), ...):
        ...
        return PaginatedResponse[ApplicationResponse](
            items=[...],
            total=total_count,
            page=page,
            limit=limit,
            total_pages=math.ceil(total_count / limit) if limit else 0,
        )
"""

from typing import Generic, List, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard shape for all paginated list endpoints."""

    items: List[T] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 10
    total_pages: int = 0


class PaginationParams(BaseModel):
    """Optional: reusable dependency for pagination query params."""

    page: int = Field(1, ge=1, description="1-based page number")
    limit: int = Field(10, ge=1, le=100, description="Items per page (max 100)")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit