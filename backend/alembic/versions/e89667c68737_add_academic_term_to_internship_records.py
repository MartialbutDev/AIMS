
"""Add academic-term columns to internship records.

Revision ID: e89667c68737
Revises: 386c261dd991
Create Date: 2026-10-22 21:16:32.786586

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Revision identifiers used by Alembic.
revision: str = "e89667c68737"

down_revision: Union[str, Sequence[str], None] = (
    "386c261dd991"
)

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


# ============================================================
# TABLES REQUIRING ACADEMIC-TERM ISOLATION
# ============================================================

TERM_TABLES = (
    "applications",
    "coordinator_evaluations",
    "daily_time_records",
    "documents",
    "journals",
)


# ============================================================
# UPGRADE
# ============================================================

def upgrade() -> None:
    """
    Add academic-year and semester columns.

    Existing records remain unchanged.

    Columns are initially nullable to preserve historical
    data whose academic term has not yet been verified.
    """

    for table_name in TERM_TABLES:

        # Academic year, e.g. 2026-2027
        op.add_column(
            table_name,
            sa.Column(
                "academic_year",
                sa.String(length=9),
                nullable=True,
            ),
        )

        # Semester, e.g. 1 or 2
        op.add_column(
            table_name,
            sa.Column(
                "semester",
                sa.String(length=1),
                nullable=True,
            ),
        )

        # Academic-year lookup index
        op.create_index(
            f"ix_{table_name}_academic_year",
            table_name,
            ["academic_year"],
            unique=False,
        )

        # Semester lookup index
        op.create_index(
            f"ix_{table_name}_semester",
            table_name,
            ["semester"],
            unique=False,
        )


# ============================================================
# DOWNGRADE
# ============================================================

def downgrade() -> None:
    """
    Remove the academic-term indexes and columns.

    WARNING:
    Downgrading removes academic-term values stored
    after this migration was applied.
    """

    for table_name in reversed(TERM_TABLES):

        op.drop_index(
            f"ix_{table_name}_semester",
            table_name=table_name,
        )

        op.drop_index(
            f"ix_{table_name}_academic_year",
            table_name=table_name,
        )

        op.drop_column(
            table_name,
            "semester",
        )

        op.drop_column(
            table_name,
            "academic_year",
        )
