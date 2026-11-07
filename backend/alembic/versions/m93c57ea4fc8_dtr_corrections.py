"""Audited DTR correction requests."""
from alembic import op
import sqlalchemy as sa
revision="m93c57ea4fc8"
down_revision="l82b46d93eb7"
branch_labels=None
depends_on=None
def upgrade():
    op.create_table("dtr_corrections",
        sa.Column("id",sa.String(36),primary_key=True),
        sa.Column("dtr_id",sa.String(36),nullable=False),
        sa.Column("deployment_id",sa.String(36),nullable=False),
        sa.Column("student_id",sa.String(36),nullable=False),
        sa.Column("status",sa.String(24),nullable=False),
        sa.Column("original",sa.JSON(),nullable=False),
        sa.Column("proposed",sa.JSON(),nullable=False),
        sa.Column("history",sa.JSON(),nullable=False),
        sa.Column("created_at",sa.DateTime(),nullable=False))
    op.create_index("ix_dtr_corrections_dtr_id","dtr_corrections",["dtr_id"])
def downgrade():
    raise RuntimeError("Correction history requires a reviewed retention plan.")
