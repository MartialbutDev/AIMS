
"""Authentication helpers for AIMS."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole


pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login/form"
)

optional_oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login/form",
    auto_error=False
)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    claims = data.copy()

    claims["exp"] = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    return jwt.encode(
        claims,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        ) from exc


def _user_from_access_token(
    token: str,
    db: Session
) -> User:
    payload = decode_token(token)

    # Password-reset and verification tokens cannot access APIs.
    if payload.get("purpose") not in (None, "access"):
        raise HTTPException(
            status_code=401,
            detail="Invalid access token"
        )

    user_id = payload.get("sub")

    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid access token"
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )

    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    return _user_from_access_token(token, db)


async def get_current_user_from_token(
    token: Optional[str] = Query(default=None),
    header_token: Optional[str] = Depends(
        optional_oauth2_scheme
    ),
    db: Session = Depends(get_db)
) -> User:
    """
    Legacy image endpoints.

    Prefer Authorization headers.
    Query-string tokens should be phased out because
    they can leak through URLs and server logs.
    """

    chosen = header_token or token

    if not chosen:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    return _user_from_access_token(chosen, db)


def require_role(required_role: str):
    """Require a role, with an administrator override."""

    async def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        role = UserRole(current_user.role)

        if role not in (
            UserRole(required_role),
            UserRole.ADMIN
        ):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )

        return current_user

    return role_checker
