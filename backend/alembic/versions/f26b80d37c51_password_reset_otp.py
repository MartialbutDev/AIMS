"""Backend-owned EmailJS password-reset challenges and shared throttles."""
from alembic import op
import sqlalchemy as sa

revision = 'f26b80d37c51'
down_revision = 'e15a79c26b40'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('password_reset_challenges',
        sa.Column('email_key', sa.String(64), primary_key=True),
        sa.Column('id', sa.String(36), nullable=False, unique=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('password_fingerprint', sa.String(64)),
        sa.Column('otp_digest', sa.String(64)), sa.Column('grant_digest', sa.String(64)),
        sa.Column('state', sa.String(16), nullable=False), sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False), sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('verified_until', sa.DateTime()), sa.Column('last_requested_at', sa.DateTime(), nullable=False))
    op.create_table('password_reset_limits', sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('window_started_at', sa.DateTime(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False), sa.Column('last_at', sa.DateTime(), nullable=False))
    op.create_table('password_reset_revocations',
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('reset_at', sa.DateTime(), nullable=False))


def downgrade():
    if op.get_bind().execute(sa.text('SELECT count(*) FROM password_reset_revocations')).scalar():
        raise RuntimeError('Password-reset revocations exist. Preserve their session protection before reverting.')
    for table in ['password_reset_revocations', 'password_reset_limits', 'password_reset_challenges']:
        op.drop_table(table)
