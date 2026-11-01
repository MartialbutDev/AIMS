"""Initialize a genuinely empty database at the current schema revision.

Existing installations must use Alembic upgrade; this command never stamps
an existing schema or copies a development database over a deployed database.
"""
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from app.core.database import Base, engine
import app.models  # Register every table before resolving foreign keys.


def bootstrap(connection):
    if connection.dialect.name == 'postgresql':
        connection.execute(text('SELECT pg_advisory_xact_lock(460193852)'))
    if inspect(connection).get_table_names():
        raise RuntimeError('Database is not empty. Use python -m alembic upgrade head; no tables were changed.')
    config = Config(str(Path(__file__).with_name('alembic.ini')))
    config.attributes['connection'] = connection
    Base.metadata.create_all(bind=connection)
    command.stamp(config, 'head')


def main():
    with engine.begin() as connection:
        bootstrap(connection)
    print('Empty database initialized at the current migration revision. Create your administrator account next.')


if __name__ == '__main__':
    main()
