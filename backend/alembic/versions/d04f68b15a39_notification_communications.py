"""Private messages and opt-in notification email delivery."""
from alembic import op
import sqlalchemy as sa

revision = 'd04f68b15a39'
down_revision = 'c93e57a04f28'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('notification_messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('sender_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('recipient_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('request_id', sa.String(36), nullable=False),
        sa.Column('reply_to', sa.String(36), sa.ForeignKey('notification_messages.id')),
        sa.Column('subject', sa.String(160), nullable=False), sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('sender_id', 'request_id', name='uq_message_sender_request'))
    for key in ['sender_id', 'recipient_id', 'created_at']:
        op.create_index('ix_notification_messages_'+key, 'notification_messages', [key])
    op.create_table('notification_delivery_preferences',
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('email_enabled', sa.Boolean(), nullable=False), sa.Column('enabled_at', sa.DateTime()))
    op.create_table('notification_email_deliveries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('notification_id', sa.String(36), sa.ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('status', sa.String(24), nullable=False), sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('sent_at', sa.DateTime()), sa.Column('error', sa.String(200)))
    op.create_index('ix_notification_email_deliveries_status', 'notification_email_deliveries', ['status'])


def downgrade():
    if op.get_bind().execute(sa.text('SELECT count(*) FROM notification_messages')).scalar():
        raise RuntimeError('Private message history exists. Export and preserve it before reverting.')
    for table in ['notification_email_deliveries', 'notification_delivery_preferences', 'notification_messages']:
        op.drop_table(table)
