
"""Development-only database bootstrap.

Existing schema changes require Alembic migrations.
"""

from app.core.database import Base, engine
import app.models


def init_database() -> None:
    print("Creating missing AIMS database tables...")

    Base.metadata.create_all(bind=engine)

    print(
        "Done. Existing tables were not migrated; "
        "use Alembic for schema changes."
    )


if __name__ == "__main__":
    init_database()
