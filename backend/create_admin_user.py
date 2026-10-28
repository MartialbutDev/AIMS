import getpass
import sys
import uuid

from sqlalchemy import func

from app.core.database import SessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole


EMAIL = "admin@gmail.com"
FIRST_NAME = "Admin"
LAST_NAME = "Main"


def main():
    password = getpass.getpass("Enter password for admin: ")

    if len(password) < 12:
        print("Error: Use a password with at least 12 characters.")
        sys.exit(1)

    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Error: Passwords do not match.")
        sys.exit(1)

    # Use the same hashing function as the AIMS registration/login system.
    password_hash = get_password_hash(password)

    # Confirm the generated hash works with the application's verifier.
    if not verify_password(password, password_hash):
        print("Error: Password hash verification failed.")
        sys.exit(1)

    db = SessionLocal()

    try:
        existing_user = (
            db.query(User)
            .filter(func.lower(User.email) == EMAIL.lower())
            .first()
        )

        if existing_user:
            print(
                f"Error: An account with email '{EMAIL}' already exists. "
                "No changes were made."
            )
            sys.exit(1)

        user = User(
            id=str(uuid.uuid4()),
            email=EMAIL,
            student_id=None,
            first_name=FIRST_NAME,
            middle_name=None,
            last_name=LAST_NAME,
            phone=None,
            gender=None,
            hashed_password=password_hash,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        # Verify the account was saved with the intended values.
        print("\nAdmin account created successfully.")
        print(f"ID: {user.id}")
        print(f"Email: {user.email}")
        print(f"Name: {user.first_name} {user.last_name}")
        print(f"Role: {user.role.value}")
        print(f"Active: {user.is_active}")
        print(f"Verified: {user.is_verified}")
        print(f"Student ID: {user.student_id}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
