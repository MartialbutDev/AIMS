"""Record the full MOA notarization date separately from legacy year-only records."""

import sqlalchemy as sa
from alembic import op

revision = "aa37e91c83ea"
down_revision = "z26d80fb72df"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("companies", sa.Column("moa_notarized_at", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("companies", "moa_notarized_at")
