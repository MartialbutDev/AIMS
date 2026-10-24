
"""
AIMS - Coordinator Assignment Migration (Stage 1)

Adds academic-year and semester columns without deleting
existing assignments or guessing their academic terms.

This migration does NOT remove the old unique constraint yet.
"""

from sqlalchemy import inspect, text
from app.core.database import engine


TABLE = "coordinator_student_assignments"
BACKUP = "coordinator_student_assignments_backup_pre_term"


def main():
    if engine.dialect.name != "postgresql":
        raise RuntimeError(
            "This migration requires PostgreSQL."
        )

    with engine.begin() as connection:
        inspector = inspect(connection)

        if not inspector.has_table(TABLE):
            raise RuntimeError(
                f"Required table '{TABLE}' does not exist."
            )

        # Create a one-time backup before altering the table.
        connection.execute(
            text(
                f"""
                CREATE TABLE IF NOT EXISTS {BACKUP}
                AS TABLE {TABLE} WITH DATA
                """
            )
        )

        original_count = connection.execute(
            text(f"SELECT COUNT(*) FROM {TABLE}")
        ).scalar_one()

        backup_count = connection.execute(
            text(f"SELECT COUNT(*) FROM {BACKUP}")
        ).scalar_one()

        if original_count != backup_count:
            raise RuntimeError(
                "Backup count differs from current table. "
                "Stop and inspect the backup before continuing."
            )

        # Existing assignments have no verified term,
        # so these columns must initially be nullable.
        connection.execute(
            text(
                f"""
                ALTER TABLE {TABLE}
                ADD COLUMN IF NOT EXISTS
                academic_year VARCHAR(9)
                """
            )
        )

        connection.execute(
            text(
                f"""
                ALTER TABLE {TABLE}
                ADD COLUMN IF NOT EXISTS
                semester VARCHAR(1)
                """
            )
        )

        # Validate values when present.
        connection.execute(
            text(
                f"""
                ALTER TABLE {TABLE}
                DROP CONSTRAINT IF EXISTS
                ck_coordinator_assignment_semester
                """
            )
        )

        connection.execute(
            text(
                f"""
                ALTER TABLE {TABLE}
                ADD CONSTRAINT
                ck_coordinator_assignment_semester
                CHECK (
                    semester IS NULL
                    OR semester IN ('1', '2')
                )
                """
            )
        )

        connection.execute(
            text(
                f"""
                CREATE INDEX IF NOT EXISTS
                ix_coordinator_assignment_coordinator_term
                ON {TABLE}
                (coordinator_id, academic_year, semester)
                """
            )
        )

        print("Migration Stage 1 completed.")
        print(f"Assignments preserved: {original_count}")
        print(f"Backup table: {BACKUP}")
        print(
            "Existing academic terms remain NULL "
            "until verified."
        )


if __name__ == "__main__":
    main()
