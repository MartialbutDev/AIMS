"""One company row lock serializes intake edits and all company acceptances."""
import json
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import func, inspect
from app.models.company import Company
from app.models.company_intake import CompanyIntake, CompanyIntakeEvent
from app.models.application import Application, ApplicationStatus
from app.models.hte_supervisor_company import HTESupervisorCompany
from app.models.user import UserRole
from app.core.assignment_access import get_current_academic_term
from app.schemas.company_intake import IntakeTerm


def today():
    return datetime.now(timezone(timedelta(hours=8))).date()


def ready(db):
    return all(inspect(db.connection()).has_table(name) for name in ('company_intakes', 'company_intake_events'))


def require_schema(db):
    if not ready(db):
        raise HTTPException(503, 'Company intake configuration is unavailable. Ask the administrator to apply the database update.')


def term(db, academic_year=None, semester=None):
    if academic_year is None and semester is None:
        academic_year, semester = get_current_academic_term(db)
    try:
        value = IntakeTerm(academic_year=academic_year, semester=semester)
    except ValueError:
        raise HTTPException(422, 'Select a valid academic year and semester.') from None
    return value.academic_year, value.semester


def company(db, identifier, lock=False):
    query = db.query(Company).filter(Company.id == identifier)
    if lock:
        query = query.populate_existing().with_for_update()
    value = query.first()
    if value is None:
        raise HTTPException(404, 'Company not found.')
    return value


def authorize(db, actor, company_id, write=False):
    if actor.role in (UserRole.ADMIN, UserRole.CAREER_CENTER):
        return
    if not write and actor.role == UserRole.HTE_SUPERVISOR:
        link = db.query(HTESupervisorCompany).filter_by(supervisor_id=actor.id, company_id=company_id, is_active=True).first()
        if link:
            return
    raise HTTPException(403, 'Company intake access denied.')


def accepted_counts(db, identifiers, year, semester):
    return dict(db.query(Application.company_id, func.count(func.distinct(Application.student_id))).filter(
        Application.company_id.in_(identifiers), Application.academic_year == year,
        Application.semester == semester, Application.status == ApplicationStatus.ACCEPTED,
    ).group_by(Application.company_id).all()) if identifiers else {}


def summaries(db, partners, year=None, semester=None):
    year, semester = term(db, year, semester)
    ids = [p.id for p in partners]
    counts = accepted_counts(db, ids, year, semester)
    schema = ready(db)
    policies = {r.company_id: r for r in db.query(CompanyIntake).filter(CompanyIntake.company_id.in_(ids),
        CompanyIntake.academic_year == year, CompanyIntake.semester == semester).all()} if schema and ids else {}
    result = {}
    for partner in partners:
        policy = policies.get(partner.id)
        count = counts.get(partner.id, 0)
        remaining = max(0, policy.capacity - count) if policy else None
        status = 'unavailable' if not schema else 'not_configured' if not policy else 'closed' if not policy.accepting else 'full' if not remaining else 'accepting'
        if not partner.is_active and policy:
            status = 'closed'
        result[partner.id] = dict(academic_year=year, semester=semester, capacity=policy.capacity if policy else None,
            accepted=count, remaining=remaining, accepting=bool(policy and policy.accepting), status=status,
            can_apply=status == 'accepting', version=policy.version if policy else 0)
    return result


def policy(db, identifier, year, semester):
    return db.query(CompanyIntake).filter_by(company_id=identifier, academic_year=year, semester=semester).populate_existing().first()


def require_capacity(db, identifier, year, semester, *, new_application):
    require_schema(db)
    # Callers hold student/application locks first, then this same company lock.
    # Edits lock the company too; the accepted count is read after lock acquisition.
    partner = company(db, identifier, lock=True)
    row = policy(db, identifier, year, semester)
    if not row:
        raise HTTPException(409, 'Company capacity is awaiting Career Center configuration for this term.')
    if new_application and (not partner.is_active or not row.accepting):
        raise HTTPException(409, 'This company is not accepting new internship applications for this term.')
    count = accepted_counts(db, [identifier], year, semester).get(identifier, 0)
    if count >= row.capacity:
        raise HTTPException(409, 'This company has no remaining internship slots for this term.')
    return row


def document_metadata(value):
    if not value:
        return None
    data = json.loads(value) if isinstance(value, str) else value
    return {key: data[key] for key in ('filename', 'size', 'sha256')}


def detail(db, partner, year, semester):
    state = summaries(db, [partner], year, semester)[partner.id]
    row = policy(db, partner.id, year, semester)
    history = db.query(CompanyIntakeEvent).filter_by(intake_id=row.id).order_by(
        CompanyIntakeEvent.created_at.desc(), CompanyIntakeEvent.id.desc()).limit(20).all() if row else []
    return dict(company_id=partner.id, company_name=partner.name, **state,
        confirmation_date=row.confirmation_date if row else None,
        confirmation_reference=row.confirmation_reference if row else None,
        supporting_document=document_metadata(row.supporting_file) if row else None,
        updated_at=row.updated_at if row else None,
        history=[dict(id=e.id, actor=e.actor_name, action=e.action, created_at=e.created_at,
            **{k: v for k, v in json.loads(e.snapshot).items() if k != 'supporting_file'},
            supporting_document=document_metadata(json.loads(e.snapshot).get('supporting_file'))) for e in history])


def record_capacity(db, partner, actor, capacity, expected_version=None):
    """Save the current term's capacity in the same transaction as company details."""
    from app.models.company_intake import utcnow
    require_schema(db)
    partner = company(db, partner.id, lock=True)
    year, semester = term(db)
    row = policy(db, partner.id, year, semester)
    if expected_version is not None and expected_version != (row.version if row else 0):
        raise HTTPException(409, 'Company capacity changed. Reload the company before saving.')
    count = accepted_counts(db, [partner.id], year, semester).get(partner.id, 0)
    if capacity < count:
        raise HTTPException(409, f'Intern capacity cannot be below {count} accepted students.')
    if row is None:
        row = CompanyIntake(company_id=partner.id, academic_year=year, semester=semester,
            capacity=capacity, accepting=True, confirmation_date=today(), version=1)
        db.add(row)
    elif row.capacity == capacity:
        return row
    else:
        row.capacity = capacity
        row.version += 1
    row.updated_by, row.updated_at = actor.id, utcnow()
    db.flush()
    db.add(CompanyIntakeEvent(intake_id=row.id, actor_id=actor.id,
        actor_name=' '.join(filter(None, (actor.first_name, getattr(actor, 'middle_name', None), actor.last_name))),
        action='capacity_set' if row.version == 1 else 'capacity_updated',
        snapshot=json.dumps(dict(company_id=partner.id, academic_year=year, semester=semester,
            capacity=row.capacity, accepting=row.accepting, version=row.version))))
    return row
