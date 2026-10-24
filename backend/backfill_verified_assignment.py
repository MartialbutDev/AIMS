
from sqlalchemy import text
from app.core.database import engine

ASSIGNMENT_ID = "f999b8c8-00f6-4d16-b309-64df84606cae"

with engine.begin() as connection:
    result = connection.execute(
        text("""
            UPDATE coordinator_student_assignments
            SET academic_year = :academic_year,
                semester = :semester
            WHERE id = :assignment_id
              AND academic_year IS NULL
              AND semester IS NULL
        """),
        {
            "academic_year": "2025-2026",
            "semester": "2",
            "assignment_id": ASSIGNMENT_ID,
        },
    )

    if result.rowcount != 1:
        raise RuntimeError(
            "Expected exactly one unassigned-term record. "
            "No changes were committed."
        )

    print("Historical assignment updated successfully.")
