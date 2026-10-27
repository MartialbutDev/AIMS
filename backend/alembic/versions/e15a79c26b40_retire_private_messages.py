"""Retire private messaging while preserving existing records outside the app."""
import json
from alembic import op
import sqlalchemy as sa

revision = 'e15a79c26b40'
down_revision = 'd04f68b15a39'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # Constraint-free archives must not keep users tied to a retired feature.
    op.execute('CREATE TABLE retired_private_messages AS SELECT * FROM notification_messages')
    op.drop_table('notification_messages')
    ids = []
    for row in bind.execute(sa.text('SELECT id, data FROM notifications')):
        try:
            payload = json.loads(row.data or '{}')
        except (TypeError, ValueError):
            continue
        if isinstance(payload, dict) and payload.get('source') == 'message':
            ids.append(row.id)
    # Preserve related inbox and delivery records, then remove dead feature alerts.
    for live, archive, key in [
        ('push_deliveries', 'retired_private_message_push_deliveries', 'notification_id'),
        ('notification_email_deliveries', 'retired_private_message_email_deliveries', 'notification_id'),
        ('notifications', 'retired_private_message_notifications', 'id'),
    ]:
        op.execute(f'CREATE TABLE {archive} AS SELECT * FROM {live} WHERE 1=0')
        for identifier in ids:
            bind.execute(sa.text(f'INSERT INTO {archive} SELECT * FROM {live} WHERE {key} = :identifier'), {'identifier': identifier})
            bind.execute(sa.text(f'DELETE FROM {live} WHERE {key} = :identifier'), {'identifier': identifier})


def downgrade():
    raise RuntimeError('Private messaging was retired. Restore the archived records and feature explicitly if it is brought back into scope.')
