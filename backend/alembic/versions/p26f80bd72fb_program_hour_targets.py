"""Add nullable per-program targets without rewriting past term requirements."""
from alembic import op
import sqlalchemy as sa
revision='p26f80bd72fb'
down_revision='o15e79ac61ea'
branch_labels=None
depends_on=None

def upgrade():
    op.add_column('academic_requirements',sa.Column('program_requirements',sa.JSON(),nullable=True))

def downgrade():
    raise RuntimeError('Program target history must be retained; no automatic destructive downgrade.')
