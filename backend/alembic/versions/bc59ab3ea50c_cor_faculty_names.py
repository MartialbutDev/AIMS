"""Add administrator-confirmed COR faculty names to term designations."""

from alembic import op
import sqlalchemy as sa

revision = "bc59ab3ea50c"
down_revision = "ab48fa2d94fb"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "dean_coordinator_designations",
        sa.Column("cor_faculty_names", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade():
    op.drop_column("dean_coordinator_designations", "cor_faculty_names")
