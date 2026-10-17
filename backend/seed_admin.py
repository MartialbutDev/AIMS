import os
import sys
import uuid

from sqlalchemy import func

from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole

ADMIN_EMAIL = "admin@aims.local"


def main() -> int:
    password = os.environ.get("AIMS_ADMIN_PASSWORD")
    if not password:
        print("Set AIMS_ADMIN_PASSWORD in the environment before running this script.")
        return 2
    if len(password) < 8:
        print("The bootstrap password must be at least 8 characters.")
        return 2

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(func.lower(User.email) == ADMIN_EMAIL).first()
        if user and user.role != UserRole.ADMIN:
            print(f"Refusing to change the role of existing account {ADMIN_EMAIL}.")
            return 1

        if user:
            user.hashed_password = get_password_hash(password)
            user.first_name = "Admin"
            user.last_name = "Administrator"
            user.is_active = True
            user.is_verified = True
            message = "Updated existing bootstrap administrator."
        else:
            user = User(
                id=str(uuid.uuid4()),
                email=ADMIN_EMAIL,
                first_name="Admin",
                last_name="Administrator",
                hashed_password=get_password_hash(password),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            message = "Created bootstrap administrator."

        db.commit()
        print(f"{message} Login identifier: admin (or {ADMIN_EMAIL}).")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
