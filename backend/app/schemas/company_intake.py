from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class IntakeTerm(BaseModel):
    academic_year: str = Field(pattern=r'^\d{4}-\d{4}$')
    semester: Literal['1', '2']

    @field_validator('academic_year')
    @classmethod
    def consecutive(cls, value):
        start, end = map(int, value.split('-'))
        if end != start + 1:
            raise ValueError('Academic year must contain consecutive years')
        return value


class CompanyIntakeInput(IntakeTerm):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    capacity: int = Field(gt=0, le=100000, strict=True)
    accepting: bool = Field(strict=True)
    confirmation_date: date
    confirmation_reference: str | None = Field(default=None, max_length=500)
    expected_version: int = Field(ge=0, strict=True)
    remove_supporting_document: bool = False

    @field_validator('confirmation_reference')
    @classmethod
    def clean_reference(cls, value):
        return value.strip() or None if value is not None else None
