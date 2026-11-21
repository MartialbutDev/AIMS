"""Company-confirmed intake capacities, private evidence and change history."""
from alembic import op
import sqlalchemy as sa

revision = 'y15c79ea61ce'
down_revision = 'x04b68df50bd'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('company_intakes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('company_id', sa.String(36), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('academic_year', sa.String(9), nullable=False),
        sa.Column('semester', sa.String(1), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('accepting', sa.Boolean(), nullable=False),
        sa.Column('confirmation_date', sa.Date(), nullable=False),
        sa.Column('confirmation_reference', sa.String(500)),
        sa.Column('supporting_file', sa.Text()),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('updated_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('company_id', 'academic_year', 'semester', name='uq_company_intake_term'),
        sa.CheckConstraint('capacity > 0', name='ck_company_intake_positive_capacity'),
        sa.CheckConstraint("semester IN ('1','2')", name='ck_company_intake_semester'),
        sa.CheckConstraint('version > 0', name='ck_company_intake_version'))
    op.create_index('ix_company_intakes_company_id', 'company_intakes', ['company_id'])
    op.create_table('company_intake_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('intake_id', sa.String(36), sa.ForeignKey('company_intakes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('actor_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('actor_name', sa.String(310), nullable=False),
        sa.Column('action', sa.String(60), nullable=False),
        sa.Column('snapshot', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_index('ix_company_intake_events_intake_id', 'company_intake_events', ['intake_id'])


def downgrade():
    op.drop_table('company_intake_events')
    op.drop_table('company_intakes')
