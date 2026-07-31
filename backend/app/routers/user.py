import uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Cookie, Response, BackgroundTasks
from sqlalchemy.orm import Session

from db.database import get_db
from models.user import User, UserRole
from schemas.user import UserBase

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

def get_current_user(user_id: Optional[str] = Cookie(None), db: Session = Depends(get_db)) -> User:
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/me", response_model=UserBase)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user