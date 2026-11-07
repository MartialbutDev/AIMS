"""Administrator-managed term requirements and change history.

Revision ID: k71a35c82da6
Revises: j60f24b71c95
"""
from alembic import op
import sqlalchemy as sa
revision='k71a35c82da6'
down_revision='j60f24b71c95'
branch_labels=None
depends_on=None


def upgrade():
    existing=set(sa.inspect(op.get_bind()).get_table_names())
    names={'academic_requirements','academic_requirement_events'}
    if names <= existing:
        expected={'academic_requirements':{'id','academic_year','semester','programs','year_levels','practicum_subject_codes','required_hours','is_active','version','updated_by','updated_at'},
                  'academic_requirement_events':{'id','requirement_id','actor_id','actor_name','reason','before','after','created_at'}}
        for table,columns in expected.items():
            if {c['name'] for c in sa.inspect(op.get_bind()).get_columns(table)} != columns:
                raise RuntimeError('Existing academic requirements tables have an unexpected schema')
        return
    if names & existing:
        raise RuntimeError('Partial academic requirements schema exists; review before activating')
    op.create_table('academic_requirements',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('academic_year',sa.String(9),nullable=False),
        sa.Column('semester',sa.String(1),nullable=False),
        sa.Column('programs',sa.JSON(),nullable=False),
        sa.Column('year_levels',sa.JSON(),nullable=False),
        sa.Column('practicum_subject_codes',sa.JSON(),nullable=False),
        sa.Column('required_hours',sa.Integer(),nullable=False),
        sa.Column('is_active',sa.Boolean(),nullable=False),
        sa.Column('version',sa.Integer(),nullable=False),
        sa.Column('updated_by',sa.String(36)),
        sa.Column('updated_at',sa.DateTime(),nullable=False),
        sa.UniqueConstraint('academic_year','semester',name='uq_academic_requirements_term'))
    op.create_index('uq_academic_requirements_active','academic_requirements',['is_active'],unique=True,
        postgresql_where=sa.text('is_active = true'),sqlite_where=sa.text('is_active = 1'))
    op.create_table('academic_requirement_events',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('requirement_id',sa.String(36),nullable=False),
        sa.Column('actor_id',sa.String(36),nullable=False),
        sa.Column('actor_name',sa.String(255),nullable=False),
        sa.Column('reason',sa.Text(),nullable=False),
        sa.Column('before',sa.JSON()),sa.Column('after',sa.JSON(),nullable=False),
        sa.Column('created_at',sa.DateTime(),nullable=False))
    op.create_index('ix_academic_requirement_events_requirement_id','academic_requirement_events',['requirement_id'])


def downgrade():
    raise RuntimeError('Academic rule history must be preserved; use a reviewed rollback plan.')
