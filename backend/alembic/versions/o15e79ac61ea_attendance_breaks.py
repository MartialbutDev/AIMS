"""Record server-timed attendance breaks without rewriting historical hours."""
from alembic import op
import sqlalchemy as sa

revision = 'o15e79ac61ea'
down_revision = 'n04d68fb50d9'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('daily_time_records', sa.Column('break_periods', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('daily_time_records', sa.Column('break_seconds', sa.Integer(), nullable=False, server_default='0'))

def downgrade():
    raise RuntimeError('Retain attendance break evidence; destructive downgrade requires a retention plan.')
