"""Approved document template libraries and immutable revisions."""
from alembic import op
import sqlalchemy as sa

revision = 'b82d40c93e16'
down_revision = 'f12a341c9b01'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('document_template_series',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('coordinator_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('academic_year', sa.String(9), nullable=False),
        sa.Column('semester', sa.String(1), nullable=False),
        sa.Column('current_revision_id', sa.String(36)),
        sa.Column('withdrawn_at', sa.DateTime()),
        sa.Column('withdrawal_reason', sa.String(500)),
        sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_index('ix_document_template_series_coordinator_id', 'document_template_series', ['coordinator_id'])
    op.create_table('document_template_revisions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('series_id', sa.String(36), sa.ForeignKey('document_template_series.id'), nullable=False),
        sa.Column('title', sa.String(160), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=False),
        sa.Column('version', sa.String(40), nullable=False),
        sa.Column('version_key', sa.String(40), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=False),
        sa.Column('approval_reference', sa.String(300), nullable=False),
        sa.Column('deadline', sa.Date()),
        sa.Column('original_filename', sa.String(200), nullable=False),
        sa.Column('storage_name', sa.String(80), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('published_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('series_id', 'version_key', name='uq_template_series_version'))
    op.create_index('ix_document_template_revisions_series_id', 'document_template_revisions', ['series_id'])


def downgrade():
    bind = op.get_bind()
    if bind.execute(sa.text('SELECT count(*) FROM document_template_revisions')).scalar():
        raise RuntimeError('Published form history exists. Preserve it before reverting this migration.')
    op.drop_table('document_template_revisions')
    op.drop_table('document_template_series')
