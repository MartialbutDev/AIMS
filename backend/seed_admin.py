
"""Bootstrap admin account.

Existing passwords remain unchanged unless --reset-password is used.
"""

import argparse
import os
import sys
import uuid

from sqlalchemy import func

from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole


ADMIN_EMAIL = "admin@aims.local"


def main() -> int:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--reset-password",
        action="store_true",
    )

    args = parser.parse_args()

    password = os.environ.get(
        "AIMS_ADMIN_PASSWORD",
        "",
    )

    if not password or len(password) < 8:
        print(
            "Set AIMS_ADMIN_PASSWORD to a strong password "
            "(at least 8 characters)."
        )
        return 2

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        user = db.query(User).filter(
            func.lower(User.email) == ADMIN_EMAIL
        ).first()

        if user and user.role != UserRole.ADMIN:
            print(
                "Refusing to change the role "
                "of the existing account."
            )
            return 1

        if user:
            if not args.reset_password:
                print(
                    "Admin already exists. Password unchanged. "
                    "Use --reset-password to change it."
                )
                return 0

            user.hashed_password = get_password_hash(
                password
            )

            user.is_active = True
            user.is_verified = True

            message = "Reset bootstrap administrator password."

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
        print(message)

        return 0

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
