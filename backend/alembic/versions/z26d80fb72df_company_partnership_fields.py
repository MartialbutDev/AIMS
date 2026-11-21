"""Add optional partnership and notarization details to the company directory."""

import sqlalchemy as sa
from alembic import op

revision = "z26d80fb72df"
down_revision = "y15c79ea61ce"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("companies", sa.Column("ustp_coverage", sa.String(255)))
    op.add_column("companies", sa.Column("nature_of_partnership", sa.String(255)))
    op.add_column("companies", sa.Column("moa_notarized", sa.Boolean()))
    op.add_column("companies", sa.Column("moa_notarized_year", sa.Integer()))
    op.add_column("companies", sa.Column("moa_effectivity_years", sa.Integer()))


def downgrade():
    op.drop_column("companies", "moa_effectivity_years")
    op.drop_column("companies", "moa_notarized_year")
    op.drop_column("companies", "moa_notarized")
    op.drop_column("companies", "nature_of_partnership")
    op.drop_column("companies", "ustp_coverage")
