
"""Schemas for administrator-controlled semester coordinator designations."""

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


class DeanCoordinatorCreate(BaseModel):
    coordinator_id: str = Field(min_length=36, max_length=36)
    academic_year: str = Field(pattern=r"^20\d{2}-20\d{2}$")
    semester: str = Field(pattern=r"^[12]$")
    cor_faculty_names: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=100)]] | None = Field(default=None, max_length=10)


class DeanCoordinatorStatus(BaseModel):
    id: str
    coordinator_id: str
    coordinator_name: str
    academic_year: str
    semester: str
    is_active: bool
