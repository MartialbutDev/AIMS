
"""
AIMS - Coordinator Assignment Migration Stage 2

Finalizes term-based coordinator assignments.

Requires:
- All existing assignments have verified academic terms.
- Stage 1 migration has completed.
"""

from sqlalchemy import inspect, text
from app.core.database import engine


TABLE = "coordinator_student_assignments"


def main():
    if engine.dialect.name != "postgresql":
        raise RuntimeError("PostgreSQL is required.")

    with engine.begin() as connection:
        inspector = inspect(connection)

        if not inspector.has_table(TABLE):
            raise RuntimeError(
                f"Table '{TABLE}' does not exist."
            )

        missing_terms = connection.execute(
            text(f"""
                SELECT COUNT(*)
                FROM {TABLE}
                WHERE academic_year IS NULL
                   OR semester IS NULL
            """)
        ).scalar_one()

        if missing_terms:
            raise RuntimeError(
                f"{missing_terms} assignments have "
                "unverified academic terms. "
                "Migration cancelled."
            )

        duplicate_terms = connection.execute(
            text(f"""
                SELECT COUNT(*)
                FROM (
                    SELECT student_id, academic_year, semester
                    FROM {TABLE}
                    GROUP BY
                        student_id,
                        academic_year,
                        semester
                    HAVING COUNT(*) > 1
                ) AS duplicates
            """)
        ).scalar_one()

        if duplicate_terms:
            raise RuntimeError(
                "Duplicate student-term assignments exist. "
                "Migration cancelled."
            )

        # Require an academic term on every assignment.
        connection.execute(
            text(f"""
                ALTER TABLE {TABLE}
                ALTER COLUMN academic_year SET NOT NULL
            """)
        )

        connection.execute(
            text(f"""
                ALTER TABLE {TABLE}
                ALTER COLUMN semester SET NOT NULL
            """)
        )

        # Replace the legacy one-assignment-per-student rule.
        connection.execute(
            text(f"""
                ALTER TABLE {TABLE}
                DROP CONSTRAINT IF EXISTS
                uq_coordinator_assignment_student
            """)
        )

        # Allow one assignment per student per term.
        connection.execute(
            text(f"""
                ALTER TABLE {TABLE}
                ADD CONSTRAINT
                uq_coordinator_assignment_student_term
                UNIQUE (
                    student_id,
                    academic_year,
                    semester
                )
            """)
        )

        print("Stage 2 migration completed successfully.")
        print("Academic year and semester are required.")
        print("Semester-based uniqueness is now enforced.")


if __name__ == "__main__":
    main()
