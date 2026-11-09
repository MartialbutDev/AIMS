"""Company-confirmed attendance and separate capture evidence; no historical approvals fabricated."""
from alembic import op
import sqlalchemy as sa
revision='n04d68fb50d9'
down_revision='m93c57ea4fc8'
branch_labels=None
depends_on=None

def upgrade():
    columns=[sa.Column('deployment_id',sa.String(36)),sa.Column('attendance_revision',sa.Integer(),nullable=False,server_default='1'),
        sa.Column('company_status',sa.String(20),nullable=False,server_default='awaiting'),sa.Column('company_reviewed_by',sa.String(36)),
        sa.Column('company_reviewed_at',sa.DateTime()),sa.Column('company_review_revision',sa.Integer()),sa.Column('company_feedback',sa.Text()),
        sa.Column('coordinator_reviewed_by',sa.String(36)),sa.Column('coordinator_review_revision',sa.Integer()),
        sa.Column('evidence_in',sa.JSON()),sa.Column('evidence_out',sa.JSON()),sa.Column('attendance_history',sa.JSON(),nullable=False,server_default='[]'),
        sa.Column('capture_in_id',sa.String(36)),sa.Column('capture_out_id',sa.String(36))]
    for column in columns:op.add_column('daily_time_records',column)
    op.create_index('ix_daily_time_records_deployment_id','daily_time_records',['deployment_id'])
    for phase in ('in','out'):op.create_index('uq_dtr_capture_'+phase,'daily_time_records',['capture_'+phase+'_id'],unique=True)

def downgrade():
    raise RuntimeError('Attendance review history requires an explicit retention plan; no automatic destructive downgrade.')
