"""Add Expo device registrations and durable delivery tracking."""
from alembic import op
import sqlalchemy as sa
revision = 'f12a341c9b01'
down_revision = 'e89667c68737'
branch_labels = None
depends_on = None

def upgrade():
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if 'push_devices' not in existing:
        op.create_table('push_devices',
            sa.Column('id',sa.String(36),primary_key=True),
            sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
            sa.Column('token',sa.String(255),unique=True,nullable=False),
            sa.Column('active',sa.Boolean(),nullable=False),
            sa.Column('created_at',sa.DateTime(),server_default=sa.func.now(),nullable=False))
        op.create_index('ix_push_devices_user_id','push_devices',['user_id'])
    if 'push_deliveries' not in existing:
        op.create_table('push_deliveries',
            sa.Column('id',sa.String(36),primary_key=True),
            sa.Column('notification_id',sa.String(36),sa.ForeignKey('notifications.id'),nullable=False),
            sa.Column('device_id',sa.String(36),sa.ForeignKey('push_devices.id'),nullable=False),
            sa.Column('status',sa.String(20),nullable=False),
            sa.Column('attempts',sa.Integer(),nullable=False),
            sa.Column('ticket_id',sa.String(100)),
            sa.Column('next_attempt_at',sa.DateTime(),server_default=sa.func.now(),nullable=False),
            sa.Column('error',sa.String(200)),
            sa.UniqueConstraint('notification_id','device_id',name='uq_push_notification_device'))
        op.create_index('ix_push_deliveries_status','push_deliveries',['status'])
        op.create_index('ix_push_deliveries_next_attempt_at','push_deliveries',['next_attempt_at'])

def downgrade():
    op.drop_table('push_deliveries')
    op.drop_table('push_devices')
