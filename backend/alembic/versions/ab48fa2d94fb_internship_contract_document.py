"""Add the Internship Contract document category."""

from alembic import op

revision = "ab48fa2d94fb"
down_revision = "aa37e91c83ea"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_context().dialect.name == "postgresql":
        op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'INTERNSHIP_CONTRACT'")


def downgrade():
    # PostgreSQL enum values are additive. Preserve any saved contracts.
    pass
