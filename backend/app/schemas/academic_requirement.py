import re
from pydantic import BaseModel, Field, field_validator, model_validator

class ProgramRequirement(BaseModel):
    code: str = Field(pattern=r'^[A-Z][A-Z0-9]{1,19}$')
    name: str = Field(min_length=2,max_length=120)
    aliases: list[str] = Field(default_factory=list,max_length=30)
    required_hours: int | None = Field(default=None,ge=1,le=3000,strict=True)

    @field_validator('name')
    @classmethod
    def clean_name(cls,value):
        value=value.strip()
        if len(value)<2: raise ValueError('Enter a program name')
        return value

    @field_validator('aliases')
    @classmethod
    def clean_aliases(cls,values):
        result=list(dict.fromkeys(v.strip().upper() for v in values))
        if any(not v or len(v)>120 for v in result): raise ValueError('Program aliases must contain 1–120 characters')
        return result


class AcademicRequirementInput(BaseModel):
    academic_year: str = Field(pattern=r'^\d{4}-\d{4}$')
    semester: str = Field(pattern=r'^[12]$')
    programs: list[str] = Field(min_length=1,max_length=30)
    year_levels: list[int] = Field(min_length=1,max_length=6)
    practicum_subject_codes: list[str] = Field(min_length=1,max_length=30)
    required_hours: int | None = Field(default=None,ge=1,le=3000,strict=True)
    program_requirements: list[ProgramRequirement] | None = Field(default=None,min_length=1,max_length=30)
    expected_version: int = Field(ge=0,strict=True)
    activate: bool = False
    reason: str = Field(min_length=5,max_length=1000)

    @model_validator(mode='after')
    def validate_program_targets(self):
        if self.program_requirements is None:
            if self.required_hours is None: raise ValueError('Provide program targets or a legacy term target')
            return self
        seen={}
        codes=set()
        for program in self.program_requirements:
            if program.code in codes: raise ValueError('Program codes must be unique')
            codes.add(program.code)
            for alias in [program.code,program.name,*program.aliases]:
                compact=re.sub(r'[^A-Z0-9]','',alias.upper())
                if compact in seen and seen[compact]!=program.code: raise ValueError('Program aliases cannot belong to different programs')
                seen[compact]=program.code
        return self

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
