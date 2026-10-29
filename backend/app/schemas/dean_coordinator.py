
"""Schemas for administrator-controlled semester coordinator designations."""

from pydantic import BaseModel, Field


class DeanCoordinatorCreate(BaseModel):
    coordinator_id: str = Field(min_length=36, max_length=36)
    academic_year: str = Field(pattern=r"^20\d{2}-20\d{2}$")
    semester: str = Field(pattern=r"^[12]$")


class DeanCoordinatorStatus(BaseModel):
    id: str
    coordinator_id: str
    coordinator_name: str
    academic_year: str
    semester: str
    is_active: bool
