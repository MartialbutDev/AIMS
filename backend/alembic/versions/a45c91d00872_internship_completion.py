"""Final clearance, host feedback, completion evidence, and term-scoped grades."""
from alembic import op
import sqlalchemy as sa
revision='a45c91d00872'
down_revision='f12a341c9b01'
branch_labels=None
depends_on=None

def deployment_key():return sa.Column('deployment_id',sa.String(36),sa.ForeignKey('internship_deployments.id'),primary_key=True)
def reviewer(name,nullable=True):return sa.Column(name,sa.String(36),sa.ForeignKey('users.id'),nullable=nullable)

def upgrade():
    tables=set(sa.inspect(op.get_bind()).get_table_names())
    if 'completion_plans' not in tables:
        op.create_table('completion_plans',deployment_key(),sa.Column('policy_reference',sa.String(300),nullable=False),sa.Column('checklist_path',sa.String(500),nullable=False),sa.Column('company_form_path',sa.String(500),nullable=False),sa.Column('required_hours',sa.Integer(),nullable=False),sa.Column('passing_grade_max',sa.Float(),nullable=False),sa.Column('expected_weeks',sa.Text(),nullable=False),reviewer('configured_by',False),sa.Column('configured_at',sa.DateTime(),nullable=False,server_default=sa.func.now()))
    if 'clearance_items' not in tables:
        op.create_table('clearance_items',sa.Column('id',sa.String(36),primary_key=True),sa.Column('deployment_id',sa.String(36),sa.ForeignKey('internship_deployments.id'),nullable=False),sa.Column('label',sa.String(200),nullable=False),sa.Column('mode',sa.String(20),nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('file_path',sa.String(500)),sa.Column('original_filename',sa.String(255)),sa.Column('submitted_at',sa.DateTime()),reviewer('reviewed_by'),sa.Column('reviewed_at',sa.DateTime()),sa.Column('review_notes',sa.Text()))
        op.create_index('ix_clearance_items_deployment_id','clearance_items',['deployment_id'])
    if 'company_final_evaluations' not in tables:
        op.create_table('company_final_evaluations',deployment_key(),reviewer('supervisor_id',False),sa.Column('file_path',sa.String(500),nullable=False),sa.Column('original_filename',sa.String(255),nullable=False),sa.Column('feedback',sa.Text(),nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('submitted_at',sa.DateTime(),nullable=False),reviewer('reviewed_by'),sa.Column('reviewed_at',sa.DateTime()),sa.Column('review_notes',sa.Text()))
    if 'internship_completions' not in tables:
        op.create_table('internship_completions',deployment_key(),reviewer('completed_by',False),sa.Column('completed_at',sa.DateTime(),nullable=False),sa.Column('notes',sa.Text(),nullable=False),sa.Column('snapshot',sa.Text(),nullable=False))
    if 'completion_events' not in tables:
        op.create_table('completion_events',sa.Column('id',sa.String(36),primary_key=True),sa.Column('deployment_id',sa.String(36),sa.ForeignKey('internship_deployments.id'),nullable=False),reviewer('actor_id',False),sa.Column('action',sa.String(60),nullable=False),sa.Column('details',sa.Text(),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False,server_default=sa.func.now()))
        op.create_index('ix_completion_events_deployment_id','completion_events',['deployment_id'])
    constraints={row['name'] for row in sa.inspect(op.get_bind()).get_unique_constraints('coordinator_evaluations')}
    with op.batch_alter_table('coordinator_evaluations') as batch:
        if 'uq_coordinator_evaluation_owner' in constraints:batch.drop_constraint('uq_coordinator_evaluation_owner',type_='unique')
        if 'uq_coordinator_evaluation_term' not in constraints:batch.create_unique_constraint('uq_coordinator_evaluation_term',['coordinator_id','student_id','academic_year','semester'])

def downgrade():
    raise RuntimeError('Completion evidence and term-scoped grades must be preserved; use an audited forward correction instead of dropping official records.')
