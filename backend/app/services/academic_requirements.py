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
PROGRAM_CATALOG = [
    {'code':'BSIT','name':'Bachelor of Science in Information Technology','aliases':['BS INFORMATION TECHNOLOGY','BS IN INFORMATION TECHNOLOGY'],'required_hours':None},
    {'code':'BSDS','name':'Bachelor of Science in Data Science','aliases':['BS DATA SCIENCE','BS IN DATA SCIENCE'],'required_hours':None},
    {'code':'BSCS','name':'Bachelor of Science in Computer Science','aliases':['BS COMPUTER SCIENCE','BS IN COMPUTER SCIENCE'],'required_hours':None},
    {'code':'BSTCM','name':'Bachelor of Science in Technology Communication Management','aliases':['BS TECHNOLOGY COMMUNICATION MANAGEMENT','BS IN TECHNOLOGY COMMUNICATION MANAGEMENT'],'required_hours':None},
]


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
        'program_requirements':row.program_requirements,
        'required_hours':None if row.program_requirements is not None else row.required_hours,
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


def detect_program(text_value, programs):
    matches={p['code'] for p in programs if program_matches(text_value,[p['code'],p['name'],*p.get('aliases',[])])}
    return next(iter(matches)) if len(matches)==1 else None


def hour_target(db=None, academic_year=None, semester=None, student_id=None):
    if db is None:
        policy=rules(None,academic_year,semester)
    else:
        # Hour targets may change after deployment. Do not use an older OCR request snapshot.
        rows=load(db)
        if academic_year is not None and semester is not None:
            policy=next((r for r in rows if (r['academic_year'],r['semester'])==(academic_year,semester)),None) or {**legacy_rules(),'academic_year':academic_year,'semester':semester}
        else:
            policy=next((r for r in rows if r['is_active']),None) or legacy_rules()
    programs=policy.get('program_requirements')
    if programs is None:
        target=int(policy['required_hours']) if policy.get('required_hours') else None
        if target is not None and target<=0:target=None
        return {'required_hours':target,'program_code':None,'hours_status':'configured' if target is not None else 'not_configured','hours_notice':None if target is not None else 'Required hours awaiting configuration'}
    if db is not None and student_id:
        from app.models.internship_deployment import InternshipDeployment, DeploymentStatus
        from app.models.internship_completion import InternshipCompletionCase
        inspector=inspect(db.connection())
        if inspector.has_table(InternshipDeployment.__tablename__) and inspector.has_table(InternshipCompletionCase.__tablename__):
            archives=db.query(InternshipCompletionCase).join(InternshipDeployment,InternshipDeployment.id==InternshipCompletionCase.deployment_id).filter(
                InternshipDeployment.student_id==student_id,InternshipDeployment.academic_year==policy['academic_year'],InternshipDeployment.semester==policy['semester'],
                InternshipDeployment.status==DeploymentStatus.COMPLETED,InternshipCompletionCase.status=='completed').all()
            if len(archives)==1 and (archives[0].checklist_snapshot or {}).get('required_hours') is not None:
                snapshot=archives[0].checklist_snapshot
                return {'required_hours':snapshot['required_hours'],'program_code':snapshot.get('program_code'),'hours_status':'configured','hours_notice':None}
    code=None
    if db is not None and student_id:
        from app.models.student_onboarding import StudentOnboardingSubmission as Submission
        if inspect(db.connection()).has_table(Submission.__tablename__):
            candidates=[]
            for row in db.query(Submission).filter_by(student_id=student_id,document_kind='cor',review_status='verified'):
                details=(row.validation_result or {}).get('details') or {}
                term=(str(details.get('expected_academic_year') or details.get('detected_academic_year') or ''),str(details.get('expected_semester') or details.get('detected_semester') or ''))
                if term!=(policy['academic_year'],policy['semester']): continue
                detected=details.get('detected_program_code')
                if detected not in {p['code'] for p in programs}: detected=detect_program(row.extracted_text or '',programs)
                candidates.append(detected)
            # Ambiguous or unclassified approved COR evidence never inherits another program's hours.
            if candidates and None not in candidates and len(set(candidates))==1: code=candidates[0]
    program=next((p for p in programs if p['code']==code),None)
    target=program.get('required_hours') if program else None
    return {'required_hours':target,'program_code':code,'hours_status':'configured' if target is not None else 'not_configured' if program else 'program_unverified',
            'program_notice':None if program else 'Ask your coordinator to review the program on your approved COR for this term.',
            'hours_notice':None if target is not None else 'Required hours awaiting configuration'}


def required_hours(db=None, academic_year=None, semester=None, student_id=None):
    return hour_target(db,academic_year,semester,student_id)['required_hours']


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
    incoming['required_hours']=incoming['required_hours'] if incoming['required_hours'] is not None else row.required_hours if row else legacy_rules()['required_hours']
    targets=[p.model_dump() for p in payload.program_requirements] if payload.program_requirements is not None else None
    if effective.get('program_requirements') is not None and targets is None:
        raise HTTPException(409,'This term uses program targets; reload before saving')
    locked=in_use(db,year,semester)
    if targets is not None:
        aliases=list(dict.fromkeys(alias.upper() for p in targets for alias in [p['code'],p['name'],*p['aliases']]))
        incoming['programs']=list(dict.fromkeys([*effective['programs'],*aliases])) if locked else aliases
        old_targets=effective.get('program_requirements') or []
        if locked and any(not any(p['code']==old['code'] and set(old.get('aliases',[]))<=set(p.get('aliases',[])) and old['name']==p['name'] for p in targets) for old in old_targets):
            raise HTTPException(409,'Programs already used by this term must be retained; their hours can still be configured')
    if locked and (any(incoming[k]!=effective[k] for k in ('academic_year','semester')) or
                   any(not set(effective[k])<=set(incoming[k]) for k in ('year_levels','practicum_subject_codes')) or
                   (targets is None and any(incoming[k]!=effective[k] for k in ('programs','required_hours')))):
        raise HTTPException(409,'Enrollment rules are locked after verified CORs or deployments. Program hours remain editable with a recorded reason.')
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
    row.program_requirements=targets
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
