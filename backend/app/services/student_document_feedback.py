"""Project student-facing copy from review decisions without disclosing OCR diagnostics."""

import re

NOTICE = "Text checks support document review. They do not authenticate signatures or prove that a document is genuine."
UNREADABLE = "We couldn’t read the required information clearly. A reviewer will check your upload. If you have a clearer, complete copy, you can upload it."
CURRENT_REMAINS = "Your current approved document remains active."
WRONG_STUDENT = "The student details on this document don’t match your account. Upload your own document or contact your coordinator if your account details need correcting."
FILE_UNREADABLE = "AIMS couldn’t open this file. Upload a readable copy. If it is password-protected, use an unlocked copy."
FILE_FORMATS = "Choose a file in one of these formats: PDF, JPG or PNG."

# Only the fixed decision text is interpreted; diagnostic or extracted text
# is never returned. This also supports uploads recorded before these alerts.
WRONG_OWNER_DECISION = "The explicitly identified document owner does not match the signed-in student."
WRONG_TYPE_DECISION = "The readable text does not match the selected document type."
INSUFFICIENT_TEXT = "OCR extracted insufficient readable text."

COPY = {
    'orientation': ('orientation certificate', 'We couldn’t confirm that this certificate is for your internship orientation. A reviewer will check it.', None),
    'cor': ('COR', 'We couldn’t confirm your registration details. A reviewer will check your COR.', None),
    'resume': ('résumé or CV', 'We couldn’t confirm the details on your résumé. Your coordinator will review it.', 'This file doesn’t appear to be a résumé or CV. Upload your current résumé or CV.'),
    'application_letter': ('application letter', 'We couldn’t confirm that this is an internship application letter. Your coordinator will review it.', 'This file doesn’t appear to be an internship application letter. Upload the letter you prepared to apply for an internship.'),
    'internship_plan': ('internship plan', 'We couldn’t confirm the planned internship activities. Your coordinator will review the file.', 'This file doesn’t appear to be an internship plan. Upload the plan that lists your proposed internship activities.'),
    'waiver': ('waiver or consent form', 'Your coordinator will review your waiver or consent form before deployment.', 'This file doesn’t appear to be a waiver or consent form. Upload your internship waiver or consent form.'),
    'medical_certificate': ('medical certificate', 'Your coordinator will review your medical certificate.', 'This file doesn’t appear to be a medical certificate. Upload the complete certificate from your healthcare provider.'),
    'insurance': ('proof of insurance', 'Your coordinator will review your proof of insurance.', 'This file doesn’t appear to show insurance coverage. Upload your proof of coverage for the internship.'),
    'endorsement_letter': ('endorsement letter', 'Your coordinator will review your school-issued endorsement before forwarding your application.', 'This file doesn’t appear to be an endorsement letter. Upload the letter your school issued for this application.'),
    'acceptance_letter': ('acceptance letter', 'Your coordinator will review your company’s acceptance letter.', 'This file doesn’t confirm internship acceptance. Upload the letter from the company confirming it accepted you as an intern.'),
    'internship_contract': ('internship contract', 'Your coordinator will review your internship contract.', 'This file doesn’t appear to be an internship contract. Upload the contract for your placement.'),
    'certificate_of_completion': ('certificate of completion', 'Your coordinator will review your certificate of completion.', 'This file doesn’t confirm that you completed your internship. Upload the certificate issued for your completed internship.'),
    'transcript': ('transcript', 'Your coordinator will review your transcript.', 'This file doesn’t appear to be a transcript. Upload your transcript.'),
    'user_id': ('identification document', 'Your coordinator will review your identification document.', 'This file doesn’t appear to be an identification document. Upload the identification requested by your coordinator.'),
}
OTHER = ('supporting document', 'Your coordinator will review this supporting document.', 'This file doesn’t match the requested requirement. Check which supporting document is required, then upload it.')
UNCONFIRMED = 'We couldn’t confirm the required information. Upload a clear, complete copy of the requested document or ask your coordinator for help.'


def _academic_year(value):
    return value.replace('–', '-') if isinstance(value, str) and re.fullmatch(r'\d{4}[-–]\d{4}', value) else None


def _semester(value):
    return {'1': 'Semester 1', '2': 'Semester 2', 'summer': 'Summer'}.get(str(value).lower())


def _term(semester, year):
    return ', '.join(part for part in (_semester(semester), f'AY {year}' if year else None) if part)


def onboarding_reason(kind, *, validation=None, term=None, mismatch=False):
    validation = validation or {}
    checks = validation.get('checks') or {}
    details = validation.get('details') or {}
    active_year, active_semester = term or (details.get('expected_academic_year'), details.get('expected_semester'))
    active_year = _academic_year(active_year)
    detected_year = _academic_year(details.get('detected_academic_year'))
    if mismatch:
        if kind == 'orientation':
            suffix = f' for AY {active_year}' if active_year else ''
            return f'This file doesn’t match the orientation requirement. Upload your internship orientation certificate{suffix}.'
        active = _term(active_semester, active_year)
        suffix = f' for {active}' if active else ' for the active term'
        return f'This file doesn’t match the registration requirement. Upload your COR{suffix}.'

    if kind == 'cor' and validation.get('automatic_result') == 'mismatch' and (
        checks.get('semester_matches') is False or checks.get('academic_year_matches') is False
    ):
        detected = _term(details.get('detected_semester'), detected_year)
        active = _term(active_semester, active_year)
        if detected and active:
            return f'This COR is for {detected}. Upload your COR for {active}.'
    if validation.get('automatic_result') == 'mismatch' and details.get('student_number_conflict') is True:
        return WRONG_STUDENT
    if kind == 'orientation' and not validation.get('ocr_warning') and active_year and detected_year != active_year and detected_year and (
        details.get('detected_academic_years') == [details.get('detected_academic_year')]
    ):
        if validation.get('automatic_result') == 'mismatch':
            return f'This certificate is for AY {detected_year}. Upload your orientation certificate for AY {active_year}.'
        return f'This certificate shows AY {detected_year}. A reviewer will check it against the active AY {active_year}.'
    if validation.get('ocr_warning') or 'readable_text' in checks:
        return UNREADABLE
    return UNCONFIRMED if validation.get('automatic_result') == 'mismatch' else None


def feedback(status, version_status=None, *, kind=None, reason=None, review_notes=None, current_approved_id=None):
    status = str(status or '').lower()
    name, pending, _ = COPY.get(kind, OTHER)
    action = ''
    if version_status == 'revoked':
        label, message = 'Approval revoked', 'Approval for this document has been withdrawn.'
        action = 'Read your reviewer feedback and submit the corrected requirement.'
    elif version_status == 'superseded':
        label, message = 'Previous version', 'A newer approved version is now used for this requirement.'
        action = 'Open the current approved version. This copy remains in your history.'
    elif status == 'rejected':
        label, message = 'Rejected', review_notes or reason or UNCONFIRMED
        if current_approved_id:
            action = CURRENT_REMAINS
    elif version_status == 'pending_replacement':
        label, message = 'Pending replacement', f'Your replacement is awaiting review. {CURRENT_REMAINS}'
        action = reason or ''
    elif version_status == 'pending' or status in {'pending', 'pending_review'}:
        label, message = 'Pending review', reason or pending
    elif status == 'verified':
        label, message = 'Approved', f'Your {name} is approved.'
    else:
        label, message = 'Review required', 'The review outcome is not available yet.'
        action = 'Refresh the document status or contact your coordinator.'
    return {'status_label': label, 'reason': message, 'next_action': action, 'notice': NOTICE}


DOCUMENT_FIELDS = {'id', 'type', 'description', 'original_filename', 'file_path', 'academic_year', 'semester', 'verification_status', 'created_at', 'updated_at', 'reviewed_at', 'reviewed_by', 'review_notes', 'version_status', 'version_label', 'is_current_approved', 'current_approved_id'}


def student_document_payload(payload):
    result = {key: value for key, value in payload.items() if key in DOCUMENT_FIELDS}
    # Only deliberate human review notes are student-facing feedback.
    if payload.get('reviewed_by') in (None, '', 'system'):
        result['review_notes'] = None
    kind = payload.get('type')
    diagnostic = payload.get('validation_message') or ''
    reason = None
    if payload.get('verification_status') == 'rejected':
        if WRONG_OWNER_DECISION in diagnostic:
            reason = WRONG_STUDENT
        elif any(marker in diagnostic for marker in (WRONG_TYPE_DECISION, 'does not match the selected', 'appears to be a receipt or invoice')):
            reason = COPY.get(kind, OTHER)[2]
    elif INSUFFICIENT_TEXT in diagnostic or 'OCR extraction failed; manual review required.' in diagnostic:
        reason = UNREADABLE
    result['student_feedback'] = feedback(
        payload.get('verification_status'), payload.get('version_status'), kind=kind, reason=reason,
        review_notes=result.get('review_notes'), current_approved_id=payload.get('current_approved_id'),
    )
    return result


def student_upload_payload(payload):
    document = student_document_payload(payload['document'])
    return {'status': payload['status'], 'verified': bool(payload.get('verified')), 'file_type': payload.get('file_type'), 'document': document, 'student_feedback': document['student_feedback']}
