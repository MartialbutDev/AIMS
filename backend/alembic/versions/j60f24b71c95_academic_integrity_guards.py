"""Install the academic uniqueness guards already used by the local database.

No rows are deleted or selected as winners. Conflicting old data blocks upgrade.
"""
from alembic import op
import sqlalchemy as sa
revision='j60f24b71c95'
down_revision='i59e13a60b84'
branch_labels=None
depends_on=None
GUARDS=(('applications','uq_one_accepted_application_per_student_term',"status = 'ACCEPTED'"),
        ('internship_deployments','uq_active_student_deployment_term',"status IN ('PRE_DEPLOYMENT', 'DEPLOYED')"))


def upgrade():
    bind=op.get_bind()
    if bind.dialect.name=='postgresql':
        op.execute('LOCK TABLE applications, internship_deployments IN SHARE ROW EXCLUSIVE MODE')
    for table,name,predicate in GUARDS:
        conflicts=bind.execute(sa.text(f'SELECT 1 FROM {table} WHERE {predicate} AND academic_year IS NOT NULL AND semester IS NOT NULL GROUP BY student_id,academic_year,semester HAVING count(*)>1 LIMIT 1')).first()
        if conflicts:
            raise RuntimeError(f'{table} has conflicting current-term records. No records were removed; review the conflicts before retrying.')
        existing=next((i for i in sa.inspect(bind).get_indexes(table) if i['name']==name),None)
        if existing:
            if not existing['unique'] or existing['column_names']!=['student_id','academic_year','semester']:
                raise RuntimeError(f'{name} exists with an unexpected definition; review it before retrying.')
            continue
        op.create_index(name,table,['student_id','academic_year','semester'],unique=True,
            postgresql_where=sa.text(predicate),sqlite_where=sa.text(predicate))


def downgrade():
    raise RuntimeError('Removing academic uniqueness safeguards requires a separately reviewed migration.')
