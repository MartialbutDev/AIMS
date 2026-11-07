"""One request snapshot of academic rules; legacy settings remain the migration fallback."""
from contextvars import ContextVar
from datetime import datetime, timezone
import re

from fastapi import Depends, HTTPException
from sqlalchemy import inspect, text
from app.core.config import settings
from app.core.database import get_db
from app.models.academic_requirement import AcademicRequirement as Rule, AcademicRequirementEvent as Event

_snapshot = ContextVar('academic_requirements', default=None)
FIELDS = ('academic_year', 'semester', 'programs', 'year_levels', 'practicum_subject_codes', 'required_hours')


def legacy_rules():
    return dict(id=None, version=0, is_active=True,
        academic_year=str(settings.CURRENT_ACADEMIC_YEAR).strip(), semester=str(settings.CURRENT_SEMESTER).strip(),
        programs=['BS INFORMATION TECHNOLOGY', 'BS IN INFORMATION TECHNOLOGY', 'BSIT'], year_levels=[4],
        practicum_subject_codes=[c.strip().upper() for c in settings.PRACTICUM_SUBJECT_CODES.split(',') if c.strip()] or ['IT421'],
        required_hours=int(settings.REQUIRED_INTERNSHIP_HOURS))


def available(db):
    return inspect(db.connection()).has_table(Rule.__tablename__)


def serialize(row):
    return {**{k:getattr(row,k) for k in FIELDS}, 'id':row.id, 'version':row.version,
        'is_active':row.is_active, 'updated_by':row.updated_by,
        'updated_at':row.updated_at.isoformat() if row.updated_at else None}


def load(db):
    return [serialize(row) for row in db.query(Rule).populate_existing().all()] if available(db) else []


async def academic_policy_scope(db=Depends(get_db)):
    # Async dependency ensures the context also reaches async upload handlers and their OCR threads.
    token = _snapshot.set(load(db))
    try:
        yield
    finally:
        _snapshot.reset(token)


def rules(db=None, academic_year=None, semester=None):
    rows = _snapshot.get()
    if rows is None:
        rows = load(db) if db is not None else []
    if academic_year is not None and semester is not None:
        match = next((r for r in rows if (r['academic_year'],r['semester']) == (academic_year,semester)),None)
        return match or {**legacy_rules(), 'academic_year':academic_year,'semester':semester,'is_active':False}
    return next((r for r in rows if r['is_active']),None) or legacy_rules()


def required_hours(db=None, academic_year=None, semester=None):
    return int(rules(db,academic_year,semester)['required_hours'])


def guard_cor_approval(db, recorded=None):
    """Serialize final COR checks with administrator changes, after slow OCR finishes."""
    if available(db) and db.bind.dialect.name=='postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(71520611)'))
    expected=rules()
    fresh=next((r for r in load(db) if r['is_active']),None) or legacy_rules()
    if any(expected[k]!=fresh[k] for k in FIELDS):
        raise HTTPException(409,'Academic requirements changed while this document was being checked. Refresh and upload again.')
    if recorded is not None:
        details=recorded.get('details') or {}
        snapshot=details.get('academic_requirements') or legacy_rules()
        if any(snapshot.get(k)!=fresh[k] for k in ('programs','year_levels','practicum_subject_codes','required_hours')):
            raise HTTPException(409,'The COR was checked against older academic requirements. Reject it and request a new upload.')
        year=details.get('expected_academic_year') or details.get('detected_academic_year')
        semester=details.get('expected_semester') or details.get('detected_semester')
        if (year and year!=fresh['academic_year']) or (semester and str(semester)!=fresh['semester']):
            raise HTTPException(409,'The COR belongs to another academic term.')


def program_matches(text_value, aliases):
    for alias in aliases:
        compact = re.sub(r'[^A-Z0-9]', '', alias.upper())
        pattern = r'(?<![A-Z0-9])' + r'[\W_]*'.join(re.escape(c) for c in compact) + r'(?![A-Z0-9])'
        if re.search(pattern,text_value.upper()):
            return True
    return False


def year_level_matches(text_value, levels):
    for level in levels:
        ordinal = {1:'1ST',2:'2ND',3:'3RD',4:'4TH',5:'5TH',6:'6TH'}[level]
        if re.search(r'\b'+ordinal+r'\s+YEAR\b|\bYEAR\s*(?:LEVEL\s*)?[:\-]?\s*'+str(level)+r'\b', text_value.upper()):
            return True
    return False


def in_use(db, year, semester):
    from app.models.internship_deployment import InternshipDeployment
    from app.models.student_onboarding import StudentOnboardingSubmission as Submission
    inspector=inspect(db.connection())
    if inspector.has_table(InternshipDeployment.__tablename__) and db.query(InternshipDeployment.id).filter_by(academic_year=year,semester=semester).first():
        return True
    if inspector.has_table(Submission.__tablename__):
        for row in db.query(Submission).filter_by(document_kind='cor',review_status='verified'):
            details=(row.validation_result or {}).get('details') or {}
            term=(str(details.get('expected_academic_year') or details.get('detected_academic_year') or ''),
                  str(details.get('expected_semester') or details.get('detected_semester') or ''))
            baseline=legacy_rules()
            if term==(year,semester) or (not all(term) and (year,semester)==(baseline['academic_year'],baseline['semester'])):
                return True
    return False


def save(db, actor, payload):
    if not available(db):
        raise HTTPException(503,'Academic requirements need database activation. Contact the administrator.')
    if db.bind.dialect.name=='postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(71520611)'))
    rows=db.query(Rule).with_for_update().populate_existing().all()
    year,semester=payload.academic_year,payload.semester
    row=next((r for r in rows if (r.academic_year,r.semester)==(year,semester)),None)
    if payload.expected_version != (row.version if row else 0):
        raise HTTPException(409,'These requirements changed. Reload before saving.')
    incoming={k:getattr(payload,k) for k in FIELDS}
    previous=serialize(row) if row else None
    effective=previous or rules(db,year,semester)
    locked=in_use(db,year,semester)
    if locked and any(incoming[k]!=effective[k] for k in FIELDS):
        raise HTTPException(409,'This term already has verified CORs or deployments. Its rules are locked; create requirements for a new term.')
    # Preserve old environment-defined rules before switching away from an existing legacy cohort.
    baseline=legacy_rules()
    if not rows and (year,semester)!=(baseline['academic_year'],baseline['semester']):
        if re.fullmatch(r'\d{4}-\d{4}',baseline['academic_year']) and baseline['semester'] in ('1','2'):
            preserved=Rule(**{k:baseline[k] for k in FIELDS},is_active=not payload.activate,version=1,updated_at=datetime.now(timezone.utc).replace(tzinfo=None),updated_by=actor.id)
            db.add(preserved)
    if payload.activate:
        for item in rows:
            if item.is_active:
                item.is_active=False
        db.flush()
    if row is None:
        row=Rule(**incoming,is_active=False,version=0)
        db.add(row)
    for k,v in incoming.items(): setattr(row,k,v)
    row.version+=1
    if payload.activate or (not any(r.is_active for r in rows) and (year,semester)==(baseline['academic_year'],baseline['semester'])):
        row.is_active=True
    row.updated_by=actor.id
    row.updated_at=datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()
    after=serialize(row)
    db.add(Event(requirement_id=row.id,actor_id=actor.id,
        actor_name=f'{actor.first_name} {actor.last_name}',reason=payload.reason,before=previous,after=after,
        created_at=row.updated_at))
    db.commit()
    return {**after,'locked':locked}
