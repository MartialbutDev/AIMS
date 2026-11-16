"""Save a replayable response atomically with a submission."""
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Header, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import Session

from app.models.submission_receipt import SubmissionReceipt
from app.models.user import User

SubmissionKey = Annotated[UUID | None, Header(alias="Idempotency-Key")]


class Submission:
    def __init__(self, db: Session, user: User, operation: str, key: UUID | None):
        self.db = db
        self.identity = (user.id, operation, str(key)) if key else None
        self.receipt = None
        if self.identity is None:
            return

        # Serialize writes for this student until the record and receipt commit.
        db.execute(select(User.id).where(User.id == user.id).with_for_update()).scalar_one()
        if not inspect(db.connection()).has_table(SubmissionReceipt.__tablename__):
            raise HTTPException(503, "Submissions are temporarily unavailable. Try again shortly.")
        current = datetime.now(timezone.utc).replace(tzinfo=None)
        self.expires_at = current + timedelta(days=1)
        db.execute(delete(SubmissionReceipt).where(SubmissionReceipt.expires_at <= current))
        self.receipt = db.get(SubmissionReceipt, self.identity, populate_existing=True)

    def replay(self, model):
        if self.receipt is None:
            return None
        if self.db.get(model, self.receipt.result_id) is None:
            raise HTTPException(409, "The previous submission was removed. Start a new submission.")
        return self.receipt.response

    def save(self, result_id: str, response) -> None:
        if self.identity is not None:
            user_id, operation, key = self.identity
            self.db.add(SubmissionReceipt(
                user_id=user_id, operation=operation, key=key,
                result_id=result_id, response=jsonable_encoder(response), expires_at=self.expires_at,
            ))
