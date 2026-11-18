"""Add deployment-scoped student attendance absence requests."""
import sqlalchemy as sa
from alembic import op

revision = "w93a57ce49ac"
down_revision = "v82f46bd38fb"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "attendance_absence_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("deployment_id", sa.String(36), sa.ForeignKey("internship_deployments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workday", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("reason", sa.String(300), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("deployment_id", "workday", name="uq_attendance_absence_deployment_date"),
        sa.CheckConstraint("kind IN ('planned', 'emergency')", name="ck_attendance_absence_kind"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'declined')", name="ck_attendance_absence_status"),
    )
    op.create_index("ix_attendance_absence_requests_workday", "attendance_absence_requests", ["workday"])


def downgrade():
    op.drop_index("ix_attendance_absence_requests_workday", table_name="attendance_absence_requests")
    op.drop_table("attendance_absence_requests")
