"""Add shared login attempt limits."""
import sqlalchemy as sa
from alembic import op

revision = "q37a91ce83ac"
down_revision = "p26f80bd72fb"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "login_attempt_limits",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
    )
    op.create_index("ix_login_attempt_limits_expires_at", "login_attempt_limits", ["expires_at"])


def downgrade():
    op.drop_table("login_attempt_limits")
