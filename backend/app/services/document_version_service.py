"""Current approvals, replacement candidates, and explicit revocation barriers.

Files and submitted application attachment IDs are never rewritten.
Revocation is an audited decision in the existing document_reviews table.
"""
from collections import defaultdict
from datetime import datetime, timezone
from sqlalchemy import and_, or_, func
from app.models.document import Document, DocumentType
from app.models.document_review import DocumentReview


def group_key(document):
    return (document.uploaded_by, document.academic_year, document.semester, document.type)


def timestamp(value):
    if value is None:
        return datetime.min
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


def approved_at(document, automatic, legacy):
    return timestamp(document.reviewed_at or automatic.get(document.id) or legacy.get(document.id) or document.created_at)


def upload_order(document):
    return (timestamp(document.created_at), document.id or '')


def review_times(db, reviews):
    """Return UTC audit times without rewriting legacy database-local timestamps."""
    result = {review.id: timestamp(review.created_at) for review in reviews}
    ids = [review.id for review in reviews if review.decision not in {'revoked', 'auto_verified'}]
    if ids and db.get_bind().dialect.name == 'postgresql':
        utc = func.timezone('UTC', func.timezone(func.current_setting('TimeZone'), DocumentReview.created_at))
        result.update(dict(db.query(DocumentReview.id, utc).filter(DocumentReview.id.in_(ids)).all()))
    return result


def resolve(db, documents):
    """Input must include all versions in every supplied student/type/term group."""
    groups = defaultdict(list)
    for document in documents:
        groups[group_key(document)].append(document)
    if not groups:
        return {}, {}, set()
    by_id = {doc.id: doc for doc in documents}
    events = db.query(DocumentReview).filter(
        DocumentReview.document_id.in_(by_id), DocumentReview.decision.in_(['revoked', 'auto_verified']),
    ).all()
    barriers = {}
    revoked_ids = set()
    automatic = {}
    for review in events:
        if review.decision == 'auto_verified':
            automatic[review.document_id] = max(automatic.get(review.document_id, datetime.min), timestamp(review.created_at))
            continue
        key = group_key(by_id[review.document_id])
        barriers[key] = max(barriers.get(key, datetime.min), timestamp(review.created_at))
        revoked_ids.add(review.document_id)
    legacy = {}
    if db.get_bind().dialect.name == 'postgresql':
        # Legacy creation timestamps came from the database session timezone;
        # manual reviews and new automatic approval events use explicit UTC.
        ids = [doc.id for doc in documents if doc.verification_status == 'verified' and not doc.reviewed_at and doc.id not in automatic]
        if ids:
            utc = func.timezone('UTC', func.timezone(func.current_setting('TimeZone'), Document.created_at))
            legacy = dict(db.query(Document.id, utc).filter(Document.id.in_(ids)).all())
    current, effective = {}, {}
    for key, versions in groups.items():
        candidates = [doc for doc in versions if doc.verification_status == 'verified'
            and (key not in barriers or approved_at(doc, automatic, legacy) > barriers[key])
            and (doc.type != DocumentType.ENDORSEMENT_LETTER or (doc.reviewed_by and doc.reviewed_at))]
        if candidates:
            winner = max(candidates, key=lambda doc: (approved_at(doc, automatic, legacy), *upload_order(doc)))
            current[key] = winner
            effective[key] = winner
        else:
            # A revoked approval cannot expose an older verified copy as valid.
            unapproved = [doc for doc in versions if doc.verification_status != 'verified']
            if unapproved:
                effective[key] = max(unapproved, key=upload_order)
    return current, effective, revoked_ids


def effective_documents(db, documents):
    return list(resolve(db, documents)[1].values())


def current_approved(db, student_id, academic_year, semester, kind):
    rows = db.query(Document).filter(
        Document.uploaded_by == student_id, Document.academic_year == academic_year,
        Document.semester == semester, Document.type == kind,
    ).populate_existing().all()
    return resolve(db, rows)[0].get((student_id, academic_year, semester, kind))


def annotate(db, documents):
    """Describe supplied records using their entire version group, including history."""
    if not documents:
        return {}
    keys = {group_key(doc) for doc in documents}
    conditions = [and_(Document.uploaded_by == student, Document.academic_year == year,
        Document.semester == semester, Document.type == kind) for student, year, semester, kind in keys]
    rows = db.query(Document).filter(or_(*conditions)).populate_existing().all()
    current, _, revoked = resolve(db, rows)
    result = {}
    for document in documents:
        winner = current.get(group_key(document))
        is_current = bool(winner and winner.id == document.id)
        if document.id in revoked:
            state, label = 'revoked', 'Approval revoked'
        elif is_current:
            state, label = 'current_approved', 'Current approved'
        elif document.verification_status == 'verified':
            if document.type == DocumentType.ENDORSEMENT_LETTER and not (document.reviewed_by and document.reviewed_at):
                state, label = 'pending', 'Needs coordinator review'
            else:
                state, label = 'superseded', 'Previous version'
        elif document.verification_status == 'rejected':
            state, label = 'rejected', 'Rejected'
        elif winner:
            state, label = 'pending_replacement', 'Pending replacement'
        else:
            state, label = 'pending', 'Pending review'
        result[document.id] = {'version_status': state, 'version_label': label,
            'is_current_approved': is_current, 'current_approved_id': winner.id if winner else None}
    return result
