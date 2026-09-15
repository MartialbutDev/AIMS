# backend/app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate
from app.core.config import settings

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Get all users.
    Admin only.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user by ID.
    Users can view their own profile.
    Admins can view anyone.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Update user.
    Admin only.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    update_data = user_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """
    Delete user.
    Admin only.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


# ✅ Upload Avatar - Any authenticated user
@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload user avatar image - Any authenticated user"""
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/heic"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file to check size
    content = await file.read()
    file_size = len(content)
    await file.seek(0)
    
    # Validate file size (max 5MB)
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size: 5MB"
        )
    
    try:
        # Create avatar directory
        avatar_dir = os.path.join(settings.ASSET_DIR, "avatars")
        os.makedirs(avatar_dir, exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1].lower()
        filename = f"avatar_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{file_extension}"
        file_path = os.path.join(avatar_dir, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Delete old avatar if exists
        if current_user.avatar_url:
            old_path = os.path.join(settings.ASSET_DIR, current_user.avatar_url)
            if os.path.exists(old_path):
                os.remove(old_path)
        
        # Update user with avatar URL (relative path)
        relative_path = f"avatars/{filename}"
        current_user.avatar_url = relative_path
        db.commit()
        db.refresh(current_user)
        
        return current_user
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload avatar: {str(e)}"
        )


# ✅ Delete Avatar - DELETE method
@router.delete("/avatar")
async def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete user avatar - Any authenticated user"""
    
    print(f"🔍 DELETE avatar called by user: {current_user.id}, role: {current_user.role}")
    
    if not current_user.avatar_url:
        raise HTTPException(
            status_code=404,
            detail="No avatar found"
        )
    
    # Delete file
    file_path = os.path.join(settings.ASSET_DIR, current_user.avatar_url)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Remove from database
    current_user.avatar_url = None
    db.commit()
    
    return {"message": "Avatar deleted successfully"}


# ✅ Delete Avatar - POST method (fallback)
@router.post("/avatar/delete")
async def delete_avatar_post(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete user avatar - POST version (fallback)"""
    
    print(f"🔍 POST avatar/delete called by user: {current_user.id}, role: {current_user.role}")
    
    if not current_user.avatar_url:
        raise HTTPException(
            status_code=404,
            detail="No avatar found"
        )
    
    # Delete file
    file_path = os.path.join(settings.ASSET_DIR, current_user.avatar_url)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Remove from database
    current_user.avatar_url = None
    db.commit()
    
    return {"message": "Avatar deleted successfully"}