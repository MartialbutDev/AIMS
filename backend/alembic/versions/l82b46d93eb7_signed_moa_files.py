"""Retained private MOA file revisions."""
from alembic import op
import sqlalchemy as sa
revision='l82b46d93eb7'
down_revision='k71a35c82da6'
branch_labels=None
depends_on=None

def upgrade():
    if sa.inspect(op.get_bind()).has_table('company_moa_files'): return
    op.create_table('company_moa_files',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('company_id',sa.String(36),nullable=False),
        sa.Column('filename',sa.String(255),nullable=False),
        sa.Column('storage_name',sa.String(50),nullable=False),
        sa.Column('sha256',sa.String(64),nullable=False),
        sa.Column('size',sa.Integer(),nullable=False),
        sa.Column('uploaded_by',sa.String(36),nullable=False),
        sa.Column('uploaded_at',sa.DateTime(),nullable=False),
        sa.Column('note',sa.String(1000),nullable=False),
        sa.Column('moa_reference',sa.String(120)),
        sa.Column('effective_date',sa.String(10)),
        sa.Column('expiry_date',sa.String(10)))
    op.create_index('ix_company_moa_files_company_id','company_moa_files',['company_id'])

def downgrade():
    raise RuntimeError('Retained MOA files require a reviewed archival plan before removal.')
