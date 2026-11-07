"""Read-only administrator timeline drawn from retained workflow records."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, union_all, literal, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.user import User
from app.models.document_review import DocumentReview
from app.models.direct_placement import DirectPlacementEvent
from app.models.internship_completion import InternshipCompletionEvent
from app.models.academic_requirement import AcademicRequirementEvent
from app.models.moa_file import MoaFile

router = APIRouter(prefix="/admin/activity-history", tags=["Activity history"])
Category = Literal["all", "Documents", "Placements", "Completion", "Academic requirements", "Signed MOAs"]


def event_query(category, model, timestamp, actor, action, reference, actor_name=None):
    return select(
        literal(category).label("category"), model.id.label("event_id"),
        timestamp.label("occurred_at"), actor.label("actor_id"),
        action.label("action"), reference.label("reference"),
        (actor_name if actor_name is not None else literal(None)).label("recorded_name"),
    )


@router.get("")
def history(category: Category = "all", page: int = Query(1, ge=1, le=100000),
            db: Session = Depends(get_db), admin=Depends(require_role("admin"))):
    review, placement, completion = DocumentReview, DirectPlacementEvent, InternshipCompletionEvent
    policy, moa = AcademicRequirementEvent, MoaFile
    events = union_all(
        event_query("Documents", review, review.created_at, review.reviewer_id, review.decision, review.document_id),
        event_query("Placements", placement, placement.created_at, placement.actor_id, placement.action, placement.placement_id),
        event_query("Completion", completion, completion.created_at, completion.actor_id, completion.action, completion.case_id),
        event_query("Academic requirements", policy, policy.created_at, policy.actor_id,
                    literal("Requirements updated"), policy.requirement_id, policy.actor_name),
        event_query("Signed MOAs", moa, moa.uploaded_at, moa.uploaded_by,
                    literal("Agreement uploaded"), func.coalesce(moa.moa_reference, moa.company_id)),
    ).subquery()
    c = events.c
    query = select(c.category, c.event_id, c.occurred_at, c.action, c.reference,
                   c.recorded_name, User.first_name, User.last_name).select_from(events).outerjoin(User, User.id == c.actor_id)
    if category != "all":
        query = query.where(c.category == category)
    rows = db.execute(query.order_by(c.occurred_at.desc(), c.category, c.event_id)
                      .offset((page - 1) * 25).limit(26)).all()
    return {"has_more": len(rows) > 25, "items": [
        {"id": row.event_id, "category": row.category, "occurred_at": row.occurred_at,
         "actor": row.recorded_name or " ".join(filter(None, (row.first_name, row.last_name))) or "Unavailable",
         "action": row.action.replace("_", " ").capitalize(), "reference": row.reference}
        for row in rows[:25]
    ]}
