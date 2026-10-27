"""Public OTP endpoints; secrets and password changes stay on the backend."""
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services import password_reset_service as service

router = APIRouter()


class RequestCode(BaseModel):
    email: EmailStr = Field(max_length=255)

    @field_validator('email', mode='before')
    @classmethod
    def clean_email(cls, value):
        return value.strip() if isinstance(value, str) else value


class VerifyCode(BaseModel):
    challenge_id: UUID
    otp: str = Field(pattern=r'^[0-9]{6}$')


class CompleteReset(BaseModel):
    challenge_id: UUID
    reset_token: str = Field(min_length=40, max_length=100)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator('new_password')
    @classmethod
    def nonblank_password(cls, value):
        if not value.strip(): raise ValueError('Password cannot contain only spaces')
        return value


def client_ip(request):
    # Forwarding headers are accepted only by the deployment's trusted proxy.
    return request.client.host if request.client else 'unknown'


@router.post('/request')
def request_code(payload: RequestCode, request: Request, response: Response, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    return service.request_code(db, str(payload.email), client_ip(request), lambda *args: background_tasks.add_task(service.deliver_code, *args))


@router.post('/verify')
def verify_code(payload: VerifyCode, request: Request, response: Response, db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    return service.verify_code(db, str(payload.challenge_id), payload.otp, client_ip(request))


@router.post('/complete')
def complete_reset(payload: CompleteReset, request: Request, response: Response, db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    return service.complete_reset(db, str(payload.challenge_id), payload.reset_token, payload.new_password, client_ip(request))
