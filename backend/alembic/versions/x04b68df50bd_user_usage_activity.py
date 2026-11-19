"""Record daily foreground usage for administrator statistics."""
import sqlalchemy as sa
from alembic import op

revision = "x04b68df50bd"
down_revision = "w93a57ce49ac"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_usage_activity",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("platform", sa.String(8), primary_key=True),
        sa.Column("first_seen_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("platform IN ('web', 'mobile')", name="ck_user_usage_platform"),
    )
    op.create_index("ix_user_usage_activity_last_seen_at", "user_usage_activity", ["last_seen_at"])
    op.create_index("ix_user_usage_activity_day", "user_usage_activity", ["day"])


def downgrade():
    op.drop_index("ix_user_usage_activity_day", table_name="user_usage_activity")
    op.drop_index("ix_user_usage_activity_last_seen_at", table_name="user_usage_activity")
    op.drop_table("user_usage_activity")
