"""School-arranged placement proposals and auditable decisions."""
from alembic import op
import sqlalchemy as sa

revision = 'c93e57a04f28'
down_revision = 'b82d40c93e16'
branch_labels = None
depends_on = None


def upgrade():
    columns = [sa.Column('id',sa.String(36),primary_key=True)]
    for key, table, nullable in [('student_id','users',False),('coordinator_id','users',False),('proposed_by','users',False),('company_id','companies',True),('partnership_reviewed_by','users',True),('application_id','applications',True)]:
        columns.append(sa.Column(key,sa.String(36),sa.ForeignKey(table+'.id'),nullable=nullable))
    for key,length,nullable in [('academic_year',9,False),('semester',1,False),('company_name',255,False),('contact_person',100,True),('contact_email',255,True),('position',255,False),('status',20,False),('partnership_status',20,False),('student_decision',20,False)]:
        columns.append(sa.Column(key,sa.String(length),nullable=nullable))
    for key,nullable in [('reason',False),('partnership_basis',True),('partnership_notes',True)]:
        columns.append(sa.Column(key,sa.Text(),nullable=nullable))
    for key,nullable in [('created_at',False),('closed_at',True),('partnership_reviewed_at',True),('student_decided_at',True)]:
        columns.append(sa.Column(key,sa.DateTime(),nullable=nullable))
    op.create_table('direct_placements',*columns,sa.UniqueConstraint('application_id'))
    op.create_index('ix_direct_placements_student_id','direct_placements',['student_id'])
    op.create_index('uq_direct_placement_active_student_term','direct_placements',['student_id','academic_year','semester'],unique=True,
        postgresql_where=sa.text("status IN ('pending','released')"),sqlite_where=sa.text("status IN ('pending','released')"))
    op.create_table('direct_placement_events',sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('placement_id',sa.String(36),sa.ForeignKey('direct_placements.id'),nullable=False),
        sa.Column('actor_id',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('action',sa.String(50),nullable=False),sa.Column('details',sa.Text(),nullable=False),
        sa.Column('created_at',sa.DateTime(),nullable=False))
    op.create_index('ix_direct_placement_events_placement_id','direct_placement_events',['placement_id'])


def downgrade():
    if op.get_bind().execute(sa.text('SELECT count(*) FROM direct_placements')).scalar():
        raise RuntimeError('Direct placement history exists. Preserve records before reverting this migration.')
    op.drop_table('direct_placement_events')
    op.drop_table('direct_placements')
