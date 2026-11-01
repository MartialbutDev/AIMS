"""Separate coordinator assessments by term without guessing legacy grade ownership."""
from alembic import op
import sqlalchemy as sa
revision = 'i59e13a60b84'
down_revision = 'h48d02f59a73'
branch_labels = None
depends_on = None


def upgrade():
    existing = sa.inspect(op.get_bind()).get_unique_constraints('coordinator_evaluations')
    old = [c['name'] for c in existing if set(c['column_names']) == {'coordinator_id', 'student_id'}]
    current = any(set(c['column_names']) == {'coordinator_id', 'student_id', 'academic_year', 'semester'} for c in existing)
    with op.batch_alter_table('coordinator_evaluations') as batch:
        for name in old:
            batch.drop_constraint(name, type_='unique')
        if not current:
            batch.create_unique_constraint('uq_coordinator_evaluation_term',
                ['coordinator_id', 'student_id', 'academic_year', 'semester'])
    # NULL-term legacy rows and all existing grade values are retained unchanged.


def downgrade():
    raise RuntimeError('Term-specific assessments cannot safely be merged. Restore a reviewed backup instead.')
