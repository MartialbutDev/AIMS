"""Allow coordinator reviews to contain feedback without a numeric grade."""
import sqlalchemy as sa
from alembic import op

revision = "s59c13ea05ce"
down_revision = "r48b02df94bd"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("coordinator_evaluations") as table:
        table.alter_column("grade", existing_type=sa.Numeric(3, 2), nullable=True)


def downgrade():
    has_notes_only = op.get_bind().execute(sa.text(
        "SELECT 1 FROM coordinator_evaluations WHERE grade IS NULL LIMIT 1"
    )).first()
    if has_notes_only:
        raise RuntimeError("Cannot downgrade while coordinator reviews without grades exist.")
    with op.batch_alter_table("coordinator_evaluations") as table:
        table.alter_column("grade", existing_type=sa.Numeric(3, 2), nullable=False)
