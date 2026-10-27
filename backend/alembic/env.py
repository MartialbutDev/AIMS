
"""
Alembic Environment Configuration for AIMS.

Academic Internship Management System (AIMS)
University of Science and Technology of Southern Philippines

Purpose:
- Connect Alembic to the existing AIMS PostgreSQL database.
- Register SQLAlchemy models for migration management.
- Support online and offline migrations.
- Compare SQLAlchemy column types with PostgreSQL.
- Preserve historical backup tables during autogeneration.
"""

from logging.config import fileConfig

from alembic import context

from app.core.config import settings
from app.core.database import Base, engine

# ============================================================
# REGISTER SQLALCHEMY MODELS
# ============================================================

# Import all AIMS models so they are registered in Base.metadata.
import app.models  # noqa: F401


# ============================================================
# ALEMBIC CONFIGURATION
# ============================================================

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ============================================================
# PROTECTED DATABASE TABLES
# ============================================================

# Existing backup tables must not be modified or dropped
# by Alembic autogeneration.
EXCLUDED_TABLES = {
    "retired_private_messages",
    "retired_private_message_notifications",
    "retired_private_message_push_deliveries",
    "retired_private_message_email_deliveries",
    "coordinator_student_assignments_backup_pre_term",
}


def include_name(name, type_, parent_names):
    """
    Exclude protected tables from Alembic schema comparison.

    Prevents Alembic autogeneration from suggesting that
    historical backup tables should be deleted.
    """

    if type_ == "table" and name in EXCLUDED_TABLES:
        return False

    return True


# ============================================================
# OFFLINE MIGRATIONS
# ============================================================

def run_migrations_offline():
    """
    Run migrations without connecting directly to PostgreSQL.

    Generates SQL statements instead of executing them.
    """

    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


# ============================================================
# ONLINE MIGRATIONS
# ============================================================

def run_migrations_online():
    """
    Run migrations using the existing AIMS database engine.

    Reuses the PostgreSQL connection configured in:
    app/core/database.py
    """

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_name=include_name,
        )

        with context.begin_transaction():
            context.run_migrations()


# ============================================================
# MIGRATION EXECUTION
# ============================================================

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
