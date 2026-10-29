"""Deployment-bound completion, company confirmation, grade release and audit."""
from alembic import op
import sqlalchemy as sa

revision = 'g37c91e48d62'
down_revision = 'f26b80d37c51'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('internship_completion_cases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('deployment_id', sa.String(36), sa.ForeignKey('internship_deployments.id'), nullable=False, unique=True),
        sa.Column('status', sa.String(24), nullable=False), sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('request_note', sa.Text(), nullable=False), sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.Column('company_confirmation', sa.JSON()),
        sa.Column('approved_by', sa.String(36), sa.ForeignKey('users.id')), sa.Column('approved_at', sa.DateTime()),
        sa.Column('checklist_snapshot', sa.JSON()), sa.Column('draft_grade', sa.Numeric(3, 2)), sa.Column('draft_notes', sa.Text()),
        sa.Column('released_grade', sa.JSON()), sa.Column('grade_released_at', sa.DateTime()),
        sa.Column('grade_released_by', sa.String(36), sa.ForeignKey('users.id')))
    op.create_table('internship_completion_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('internship_completion_cases.id'), nullable=False),
        sa.Column('actor_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(40), nullable=False), sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False), sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_index('ix_internship_completion_events_case_id', 'internship_completion_events', ['case_id'])


def downgrade():
    if op.get_bind().execute(sa.text('SELECT count(*) FROM internship_completion_cases')).scalar():
        raise RuntimeError('Completion history exists. Preserve records before reverting this migration.')
    op.drop_table('internship_completion_events')
    op.drop_table('internship_completion_cases')
