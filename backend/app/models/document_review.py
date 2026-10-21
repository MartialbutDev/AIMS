
"""Review history for AIMS internship documents.

Each review decision creates a new history record.
The existing documents table remains unchanged.
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    Index,
)

from sqlalchemy.sql import func

from app.core.database import Base


class DocumentReview(Base):

    __tablename__ = "document_reviews"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    document_id = Column(
        String(36),
        nullable=False,
        index=True,
    )

    reviewer_id = Column(
        String(36),
        nullable=False,
    )

    previous_status = Column(
        String(20),
        nullable=False,
    )

    decision = Column(
        String(20),
        nullable=False,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_document_reviews_document_created",
            "document_id",
            "created_at",
        ),
    )
