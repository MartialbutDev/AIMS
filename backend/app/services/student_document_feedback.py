"""Public document feedback. Never echo OCR output or rule diagnostics to students."""

NOTICE = "Text checks support document review. They do not authenticate signatures or prove that a document is genuine."


def feedback(status, version_status=None):
    status = str(status or '').lower()
    if version_status == 'revoked':
        label, reason, action = 'Approval revoked', 'Approval for this document has been withdrawn.', 'Read your reviewer feedback and submit the corrected requirement.'
    elif version_status == 'superseded':
        label, reason, action = 'Previous version', 'A newer approved version is now used for this requirement.', 'Open the current approved version. This copy remains in your history.'
    elif version_status == 'pending_replacement':
        label, reason, action = 'Pending replacement', 'Your replacement is awaiting review. Your current approved version remains active.', 'Wait for your coordinator to review the replacement, or upload a clearer copy if needed.'
    elif version_status == 'pending' or status in {'pending', 'pending_review'}:
        label, reason, action = 'Pending review', 'This document needs review before it can be accepted for this requirement.', 'Wait for your coordinator to review it. You may upload a clearer, complete copy if needed.'
    elif status == 'verified':
        label, reason, action = 'Approved', 'This document has been accepted for this requirement.', 'Keep this copy and check your application or deployment checklist for the next requirement.'
    elif status == 'rejected':
        label, reason, action = 'Rejected', 'This submission was not accepted for the selected requirement.', 'Read your reviewer feedback, if provided. Upload a clear, complete copy of the requested document that belongs to you, or ask your coordinator for help.'
    else:
        label, reason, action = 'Review required', 'The review outcome is not available yet.', 'Refresh the document status or contact your coordinator.'
    return {'status_label': label, 'reason': reason, 'next_action': action, 'notice': NOTICE}


DOCUMENT_FIELDS = {'id', 'type', 'description', 'original_filename', 'file_path', 'academic_year', 'semester', 'verification_status', 'created_at', 'updated_at', 'reviewed_at', 'reviewed_by', 'review_notes', 'version_status', 'version_label', 'is_current_approved', 'current_approved_id'}


def student_document_payload(payload):
    result = {key: value for key, value in payload.items() if key in DOCUMENT_FIELDS}
    # Only deliberate human review notes are student-facing feedback.
    if payload.get('reviewed_by') in (None, '', 'system'):
        result['review_notes'] = None
    result['student_feedback'] = feedback(payload.get('verification_status'), payload.get('version_status'))
    return result


def student_upload_payload(payload):
    document = student_document_payload(payload['document'])
    return {'status': payload['status'], 'verified': bool(payload.get('verified')), 'file_type': payload.get('file_type'), 'document': document, 'student_feedback': document['student_feedback']}
