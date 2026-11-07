"""Conservative header-first identification; content matching is not authenticity."""
import re
from app.services.ocr_service import OCRService
from app.utils.untitled_documents import body_candidates
from app.utils.official_document_evidence import OFFICIAL_TYPES, official_evidence

# Whole title lines only: references to other forms in prose are not titles.
TITLES = {
    'resume': r'(?:(?:RESUME|RÉSUMÉ)(?: / CURRICULUM VITAE)?|CURRICULUM VITAE|CV)',
    'application_letter': r'(?:APPLICATION LETTER|LETTER OF APPLICATION|APPLICATION FOR (?:AN? )?(?:INTERNSHIP|OJT|ON[- ]THE[- ]JOB TRAINING)(?: POSITION)?)',
    'endorsement_letter': r'(?:ENDORSEMENT LETTER|LETTER OF ENDORSEMENT|ENDORSEMENT FOR (?:INTERNSHIP|OJT))',
    'acceptance_letter': r'(?:ACCEPTANCE LETTER|LETTER OF ACCEPTANCE|INTERNSHIP ACCEPTANCE)',
    'medical_certificate': r'(?:MEDICAL CERTIFICATE|CERTIFICATE OF MEDICAL FITNESS|MEDICAL CLEARANCE)',
    'waiver': r'(?:WAIVER(?: AND (?:RELEASE OF LIABILITY|CONSENT))?(?: FORM)?(?: FOR OFF[- ]CAMPUS ACTIVITIES)?|PARENTAL CONSENT(?: FORM)?)',
    'internship_plan': r'(?:(?:INTERNSHIP|OJT|PRACTICUM|TRAINING) (?:TRAINING )?PLAN)',
    'insurance': r'(?:(?:CERTIFICATE OF )?INSURANCE(?: CERTIFICATE| POLICY| COVERAGE)?|PERSONAL ACCIDENT INSURANCE)',
    'certificate_of_completion': r'(?:CERTIFICATE OF COMPLETION|INTERNSHIP COMPLETION CERTIFICATE)',
    'cor': r'(?:CERTIFICATE OF REGISTRATION|STUDENT(?:[’\']S)? ACTUAL LOAD|STUDENT ACTUAL LOAD|REGISTRATION FORM)',
    'orientation': r'(?:(?:INTERNSHIP|OJT|PRE[- ]INTERNSHIP) ORIENTATION(?: CERTIFICATE| CERTIFICATE OF (?:ATTENDANCE|PARTICIPATION))?|CERTIFICATE OF (?:ATTENDANCE|PARTICIPATION) IN (?:THE )?(?:INTERNSHIP|OJT) ORIENTATION)',
    'transcript': r'(?:TRANSCRIPT OF RECORDS|ACADEMIC TRANSCRIPT)',
    'unrelated_receipt': r'(?:(?:OFFICIAL|SALES|SHOPPING|PAYMENT) RECEIPT|(?:SALES|TAX) INVOICE)',
}
GENERIC_TYPES = {'requirements', 'document', 'user_id'}

# Exact whole-title aliases tolerate letter spacing and OCR word joins. Never
# search these compact forms as substrings of sentences or names.
TITLE_ALIASES = {
    'cor': ('CERTIFICATE OF REGISTRATION', 'STUDENT ACTUAL LOAD', 'REGISTRATION FORM'),
    'resume': ('RESUME', 'RÉSUMÉ', 'CURRICULUM VITAE', 'RESUME / CURRICULUM VITAE', 'CV'),
    'application_letter': ('APPLICATION LETTER', 'LETTER OF APPLICATION'),
    'endorsement_letter': ('ENDORSEMENT LETTER', 'LETTER OF ENDORSEMENT'),
    'acceptance_letter': ('ACCEPTANCE LETTER', 'LETTER OF ACCEPTANCE'),
    'medical_certificate': ('MEDICAL CERTIFICATE', 'MEDICAL CLEARANCE'),
    'waiver': ('WAIVER', 'WAIVER FORM', 'PARENTAL CONSENT'),
    'internship_plan': ('INTERNSHIP PLAN', 'OJT PLAN', 'INTERNSHIP TRAINING PLAN'),
    'insurance': ('CERTIFICATE OF INSURANCE', 'INSURANCE CERTIFICATE', 'INSURANCE POLICY'),
    'certificate_of_completion': ('CERTIFICATE OF COMPLETION', 'INTERNSHIP COMPLETION CERTIFICATE'),
    'orientation': ('OJT ORIENTATION CERTIFICATE', 'INTERNSHIP ORIENTATION CERTIFICATE'),
    'transcript': ('TRANSCRIPT OF RECORDS', 'ACADEMIC TRANSCRIPT'),
    'unrelated_receipt': ('OFFICIAL RECEIPT', 'SALES INVOICE', 'SHOPPING RECEIPT'),
}

def _compact_title(text: str) -> str:
    return ''.join(character for character in text.upper() if character.isalnum())

COMPACT_TITLES = {kind: {_compact_title(title) for title in titles} for kind, titles in TITLE_ALIASES.items()}


def identify_header(text: str, expected_type: str) -> dict:
    lines = [re.sub(r'\s+', ' ', line).strip(' :.-_').upper()
             for line in (text or '')[:2400].splitlines() if line.strip()][:18]
    candidates = set()
    for line in lines:
        for kind, pattern in TITLES.items():
            if (re.fullmatch(r'(?:SUBJECT\s*:\s*|RE\s*:\s*)?' + pattern, line)
                or _compact_title(line) in COMPACT_TITLES.get(kind, set())):
                candidates.add(kind)
    # Some CVs use the student's name as the title. Two section headings are
    # supporting evidence, but never override another explicit title.
    if not candidates and 'EDUCATION' in lines and any(line in {'SKILLS', 'TECHNICAL SKILLS', 'WORK EXPERIENCE'} for line in lines):
        candidates.add('resume')
    if expected_type in GENERIC_TYPES:
        status = 'not_applicable'
    elif len(candidates) > 1:
        status = 'ambiguous'
    elif not candidates:
        status = 'uncertain'
    else:
        status = 'matched' if expected_type in candidates else 'mismatch'
    detected = next(iter(candidates)) if len(candidates) == 1 else None
    if status == 'mismatch':
        message = f"The header identifies {detected.replace('_', ' ')}, which does not match the selected {expected_type.replace('_', ' ')}. Upload the correct document. Any current approved version remains active."
    elif status in {'uncertain', 'ambiguous'}:
        message = 'The header does not clearly identify the selected document type. Additional content checks and coordinator review are required.'
    elif status == 'matched':
        message = 'Header matches the selected document type. Required content and student identity are checked separately.'
    else:
        message = 'This document category requires coordinator review.'
    return {'method': 'header_first_rules', 'status': status, 'expected_type': expected_type,
            'detected_type': detected, 'candidates': sorted(candidates), 'message': message,
            'header_region': 'first_page_top_40_percent'}

def _generic_certificate_header(header: str) -> bool:
    # Accept split visual headings such as "CERTIFICATE\nOF PARTICIPATION".
    lines = [_compact_title(line) for line in (header or '')[:2400].splitlines() if line.strip()]
    titles = {'CERTIFICATEOFPARTICIPATION', 'CERTIFICATEOFATTENDANCE', 'CERTIFICATEOFCOMPLETION'}
    return any(''.join(lines[start:start + count]) in titles
               for start in range(len(lines)) for count in (1, 2, 3))


def confirm_orientation_context(identification: dict, header: str, content: str) -> dict:
    """A generic certificate needs orientation event context, never title alone."""
    if (identification.get('expected_type') != 'orientation'
        or identification.get('status') != 'uncertain'
        or not _generic_certificate_header(header)):
        return identification
    normalized = re.sub(r'\s+', ' ', content or '').upper()
    if not re.search(r'\b(?:OJT|ON[ -]THE[ -]JOB[ -]TRAINING|INTERNSHIP)\s+ORIENTATION\b', normalized):
        return identification
    return {**identification, 'status': 'matched', 'detected_type': 'orientation',
            'candidates': ['orientation'], 'method': 'header_first_with_content_confirmation',
            'message': 'Certificate header identified; OJT/Internship Orientation event confirmed in the body. Institution and registered student name must also match.',
            'content_confirmation': 'orientation_event'}


def identify_from_body(identification: dict, text: str) -> dict:
    expected = identification['expected_type']
    if (expected not in OFFICIAL_TYPES | {'document', 'application_letter', 'resume', 'internship_plan'}
        or identification['candidates'] or identification.get('warning')):
        return identification
    evidence = official_evidence(text)
    candidates = body_candidates(text) | evidence.keys()
    if len(candidates) == 1:
        detected = next(iter(candidates))
        if expected in {'document', detected}:
            if detected in evidence:
                return {**identification, 'method': 'issuer_statement', 'status': 'matched',
                        'detected_type': detected, 'candidates': [detected],
                        'message': 'Document wording supports this type. Coordinator review is required.'}
            return {**identification, 'method': 'content_structure', 'status': 'matched',
                    'detected_type': detected, 'candidates': [detected],
                    'message': 'Document type identified from its wording and structure. Identity and required content are checked separately.'}
    return identification


def inspect_upload(path: str, file_type: str, expected_type: str) -> dict:
    header_error = None
    try:
        header = OCRService.extract_header(path, file_type)
    except Exception:
        header = ''
        header_error = 'Header extraction failed; coordinator review required.'
    identification = identify_header(header, expected_type)
    if header_error:
        identification['warning'] = header_error
    # A generic completion certificate may refer to orientation rather than
    # internship completion. Resolve its event from the body before rejecting.
    if (expected_type == 'orientation' and identification['status'] == 'mismatch'
        and identification['detected_type'] == 'certificate_of_completion'
        and _generic_certificate_header(header)):
        identification = {**identification, 'status': 'uncertain', 'detected_type': None,
                          'candidates': [], 'message': 'Generic certificate header detected; orientation event context is required.'}
    if identification['status'] == 'mismatch':
        return {'text': header, 'identification': identification, 'ocr_error': None,
                'full_content_checked': False}
    try:
        text = OCRService.extract_text(path, file_type) or ''
        error = None
    except Exception:
        text = ''
        error = 'OCR extraction failed; manual review required.'
    if error is None:
        identification = confirm_orientation_context(identification, header, text)
        identification = identify_from_body(identification, text)
    return {'text': text, 'identification': identification, 'ocr_error': error,
            'full_content_checked': error is None}
