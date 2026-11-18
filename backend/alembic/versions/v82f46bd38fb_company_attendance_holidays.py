"""Store company-wide attendance reminder holidays."""
import sqlalchemy as sa
from alembic import op

revision = "v82f46bd38fb"
down_revision = "u71e35ac27ea"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "company_attendance_holidays",
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("workday", sa.Date(), primary_key=True),
        sa.Column("recorded_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_company_attendance_holidays_workday", "company_attendance_holidays", ["workday"])


def downgrade():
    op.drop_index("ix_company_attendance_holidays_workday", table_name="company_attendance_holidays")
    op.drop_table("company_attendance_holidays")
