from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, info={"workflow_notifications": True})

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# Register lazily: model imports require Base to exist first.
from sqlalchemy import event
@event.listens_for(Session, 'before_flush')
def _workflow_notifications(db, flush_context, instances):
    from app.services.workflow_notifications import capture
    capture(db, flush_context, instances)
