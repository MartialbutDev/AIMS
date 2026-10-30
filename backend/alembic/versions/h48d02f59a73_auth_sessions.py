"""Revocable account sessions without storing bearer tokens."""
from alembic import op
import sqlalchemy as sa
revision='h48d02f59a73'
down_revision='g37c91e48d62'
branch_labels=None
depends_on=None


def upgrade():
    op.create_table('auth_sessions',sa.Column('id',sa.String(64),primary_key=True),
        sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('password_fingerprint',sa.String(64),nullable=False),sa.Column('label',sa.String(80),nullable=False),
        sa.Column('created_at',sa.DateTime(),nullable=False),sa.Column('last_seen_at',sa.DateTime(),nullable=False),
        sa.Column('expires_at',sa.DateTime(),nullable=False),sa.Column('revoked_at',sa.DateTime()))
    op.create_index('ix_auth_sessions_user_id','auth_sessions',['user_id'])
    op.create_table('auth_session_cutoffs',sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id'),primary_key=True),
        sa.Column('revoked_before',sa.DateTime(),nullable=False))


def downgrade():
    raise RuntimeError('Downgrade would reactivate revoked tokens; preserve session revocations.')
