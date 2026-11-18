"""Persist attendance schedules and automatic reminder receipts."""
import sqlalchemy as sa
from alembic import op

revision = "t60d24fb16df"
down_revision = "s59c13ea05ce"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "internship_attendance_schedules",
        sa.Column("deployment_id", sa.String(36), sa.ForeignKey("internship_deployments.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("workdays", sa.JSON(), nullable=False),
        sa.Column("clock_in_at", sa.Time(), nullable=False),
        sa.Column("clock_out_at", sa.Time(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "internship_reminder_receipts",
        sa.Column("deployment_id", sa.String(36), sa.ForeignKey("internship_deployments.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("kind", sa.String(24), primary_key=True),
        sa.Column("period", sa.Date(), primary_key=True),
    )


def downgrade():
    op.drop_table("internship_reminder_receipts")
    op.drop_table("internship_attendance_schedules")
