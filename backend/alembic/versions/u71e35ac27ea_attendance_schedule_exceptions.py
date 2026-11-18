"""Store one-day company attendance schedule exceptions."""
import sqlalchemy as sa
from alembic import op

revision = "u71e35ac27ea"
down_revision = "t60d24fb16df"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "internship_attendance_exceptions",
        sa.Column("deployment_id", sa.String(36), sa.ForeignKey(
            "internship_attendance_schedules.deployment_id", ondelete="CASCADE",
        ), primary_key=True),
        sa.Column("workday", sa.Date(), primary_key=True),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("clock_in_at", sa.Time()),
        sa.Column("clock_out_at", sa.Time()),
        sa.Column("updated_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "(kind IN ('holiday', 'approved_absence') AND clock_in_at IS NULL AND clock_out_at IS NULL) "
            "OR (kind = 'shift_change' AND clock_in_at IS NOT NULL "
            "AND clock_out_at IS NOT NULL AND clock_out_at > clock_in_at)",
            name="ck_attendance_exception_times",
        ),
    )
    op.create_index("ix_internship_attendance_exceptions_workday", "internship_attendance_exceptions", ["workday"])


def downgrade():
    op.drop_index("ix_internship_attendance_exceptions_workday", table_name="internship_attendance_exceptions")
    op.drop_table("internship_attendance_exceptions")
