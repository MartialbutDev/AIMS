import re
from pydantic import BaseModel, Field, field_validator


class AcademicRequirementInput(BaseModel):
    academic_year: str = Field(pattern=r'^\d{4}-\d{4}$')
    semester: str = Field(pattern=r'^[12]$')
    programs: list[str] = Field(min_length=1,max_length=30)
    year_levels: list[int] = Field(min_length=1,max_length=6)
    practicum_subject_codes: list[str] = Field(min_length=1,max_length=30)
    required_hours: int = Field(ge=1,le=3000,strict=True)
    expected_version: int = Field(ge=0,strict=True)
    activate: bool = False
    reason: str = Field(min_length=5,max_length=1000)

    @field_validator('academic_year')
    @classmethod
    def consecutive_year(cls,value):
        a,b=map(int,value.split('-'))
        if b!=a+1: raise ValueError('Academic year must contain consecutive years')
        return value

    @field_validator('programs','practicum_subject_codes')
    @classmethod
    def clean_list(cls,values,info):
        cleaned=list(dict.fromkeys(v.strip().upper() for v in values))
        if any(not v or len(v)>120 for v in cleaned): raise ValueError('Entries must contain 1–120 characters')
        if info.field_name=='practicum_subject_codes' and any(not re.fullmatch(r'[A-Z0-9][A-Z0-9 -]{0,29}',v) for v in cleaned):
            raise ValueError('Subject codes must use letters, digits, spaces or hyphens')
        return cleaned

    @field_validator('year_levels')
    @classmethod
    def valid_levels(cls,values):
        if any(v not in range(1,7) for v in values): raise ValueError('Year levels must be between 1 and 6')
        return sorted(set(values))

    @field_validator('reason')
    @classmethod
    def clean_reason(cls,value):
        value=value.strip()
        if len(value)<5: raise ValueError('Explain the change using at least 5 characters')
        return value
