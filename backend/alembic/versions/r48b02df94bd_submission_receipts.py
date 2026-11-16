"""Persist short-lived submission receipts for safe retries."""
import sqlalchemy as sa
from alembic import op

revision = "r48b02df94bd"
down_revision = "q37a91ce83ac"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "submission_receipts",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("operation", sa.String(80), primary_key=True),
        sa.Column("key", sa.String(36), primary_key=True),
        sa.Column("result_id", sa.String(36), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_submission_receipts_expires_at", "submission_receipts", ["expires_at"])


def downgrade():
    op.drop_table("submission_receipts")
