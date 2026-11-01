"""A coordinator content review is required; OCR never authenticates signatures."""
from fastapi import HTTPException
from app.models.document import Document, DocumentType


def endorsement_state(db, student_id, academic_year, semester):
    document = db.query(Document).filter(
        Document.uploaded_by == student_id,
        Document.academic_year == academic_year, Document.semester == semester,
        Document.type == DocumentType.ENDORSEMENT_LETTER,
    ).populate_existing().order_by(Document.created_at.desc(), Document.id.desc()).first()
    reviewed = bool(document and document.reviewed_by and document.reviewed_at)
    ready = bool(document and document.verification_status == 'verified' and reviewed)
    status = document.verification_status if document else 'missing'
    if document and status == 'verified' and not reviewed: status = 'needs_coordinator_review'
    return {'ready': ready, 'status': status, 'document_id': document.id if document else None,
            'message': ('Coordinator content review recorded. Signatures are not authenticated.' if ready else
                        'Upload the endorsement letter and obtain coordinator content review before forwarding to the company. OCR does not authenticate signatures.')}


def require_endorsement(db, student_id, academic_year, semester):
    state = endorsement_state(db, student_id, academic_year, semester)
    if not state['ready']:
        raise HTTPException(409, 'A coordinator-reviewed endorsement letter is required before forwarding this application to the company. Latest endorsement status: '+state['status'].replace('_',' ')+'. OCR extracts text only and does not authenticate signatures.')
    return state
