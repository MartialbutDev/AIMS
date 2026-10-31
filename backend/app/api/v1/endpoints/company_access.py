"""Administrator management of explicit company-supervisor access links."""
from datetime import timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.company import Company
from app.models.hte_supervisor_company import HTESupervisorCompany as Link
from app.models.user import User, UserRole
from app.services.direct_placement_service import moa_state

router = APIRouter(prefix='/admin/company-access', tags=['Company access'],
                   dependencies=[Depends(require_role('admin'))])


class CompanyAccessInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    supervisor_id: str = Field(min_length=1, max_length=36)
    company_id: str = Field(min_length=1, max_length=36)


def _name(user):
    return ' '.join(filter(None, [user.first_name, user.middle_name, user.last_name]))


def _search(query, fields, text):
    text = text.strip()
    if not text:
        return query
    escaped = text.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    return query.filter(or_(*(field.ilike(f'%{escaped}%', escape='\\') for field in fields)))


def _company(company):
    return {'id': company.id, 'name': company.name, 'is_active': bool(company.is_active),
            'moa_ready': moa_state(company)['ready']}


def _rows(db):
    return db.query(Link, User, Company).join(User, Link.supervisor_id == User.id).join(Company, Link.company_id == Company.id)


def _serialize(link, user, company):
    created = link.created_at
    if created and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return {'id': link.id, 'is_active': bool(link.is_active), 'created_at': created,
            'supervisor': {'id': user.id, 'name': _name(user), 'email': user.email,
                           'is_active': bool(user.is_active), 'is_company_supervisor': user.role == UserRole.HTE_SUPERVISOR},
            'company': _company(company)}


def _one(db, link_id):
    row = _rows(db).filter(Link.id == link_id).first()
    if not row:
        raise HTTPException(404, 'Company access link not found.')
    return _serialize(*row)


@router.get('/options')
def get_options(
    supervisor_search: str = Query('', max_length=120),
    company_search: str = Query('', max_length=120),
    db: Session = Depends(get_db),
):
    supervisors = _search(db.query(User).filter(User.role == UserRole.HTE_SUPERVISOR, User.is_active.is_(True)),
                          [User.first_name, User.middle_name, User.last_name, User.email], supervisor_search)
    companies = _search(db.query(Company).filter(Company.is_active.is_(True)), [Company.name], company_search)
    return {
        'supervisor_total': supervisors.count(), 'company_total': companies.count(), 'limit': 50,
        'supervisors': [{'id': user.id, 'name': _name(user), 'email': user.email}
                        for user in supervisors.order_by(User.last_name, User.first_name, User.id).limit(50)],
        'companies': [_company(company) for company in companies.order_by(Company.name, Company.id).limit(50)],
    }


@router.get('')
def list_links(
    search: str = Query('', max_length=120),
    status: Literal['all', 'active', 'inactive'] = 'all',
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    base = _rows(db)
    query = _search(base, [User.first_name, User.middle_name, User.last_name, User.email, Company.name], search)
    if status != 'all':
        query = query.filter(Link.is_active.is_(status == 'active'))
    total = query.count()
    rows = query.order_by(Link.is_active.desc(), Company.name, User.last_name, User.first_name, Link.id).offset((page - 1) * limit).limit(limit).all()
    return {'items': [_serialize(*row) for row in rows], 'total': total, 'page': page, 'limit': limit,
            'total_pages': max(1, (total + limit - 1) // limit),
            'stats': {'active': base.filter(Link.is_active.is_(True)).count(),
                      'inactive': base.filter(Link.is_active.is_(False)).count(),
                      'supervisors': base.filter(Link.is_active.is_(True)).with_entities(func.count(func.distinct(Link.supervisor_id))).scalar() or 0}}


def _lock_parties(db, supervisor_id, company_id):
    # Use the same lock order for grant and removal. The user lock also
    # serializes simultaneous grants for a pair before its link row exists.
    user = db.query(User).filter(User.id == supervisor_id).populate_existing().with_for_update().first()
    company = db.query(Company).filter(Company.id == company_id).populate_existing().with_for_update().first()
    if not user or not company:
        raise HTTPException(404, 'Supervisor account or company not found.')
    return user, company


@router.post('')
def grant_access(payload: CompanyAccessInput, db: Session = Depends(get_db)):
    user, company = _lock_parties(db, payload.supervisor_id, payload.company_id)
    if user.role != UserRole.HTE_SUPERVISOR:
        raise HTTPException(422, 'Select an account with the Company Supervisor role.')
    if not user.is_active or not company.is_active:
        raise HTTPException(409, 'The supervisor account and company must both be active before access can be granted.')
    link = db.query(Link).filter_by(supervisor_id=user.id, company_id=company.id).populate_existing().with_for_update().first()
    if link and link.is_active:
        return {'action': 'unchanged', 'link': _one(db, link.id)}
    action = 'reactivated' if link else 'created'
    if link:
        link.is_active = True
    else:
        link = Link(supervisor_id=user.id, company_id=company.id, is_active=True)
        db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Company access changed during this request. Refresh and try again.') from None
    return {'action': action, 'link': _one(db, link.id)}


@router.delete('/{link_id}')
def remove_access(link_id: str, db: Session = Depends(get_db)):
    link = db.query(Link).filter(Link.id == link_id).first()
    if not link:
        raise HTTPException(404, 'Company access link not found.')
    _lock_parties(db, link.supervisor_id, link.company_id)
    link = db.query(Link).filter(Link.id == link_id).populate_existing().with_for_update().first()
    if not link:
        raise HTTPException(404, 'Company access link not found.')
    if not link.is_active:
        return {'action': 'unchanged', 'link': _one(db, link.id)}
    # Preserve the link identity, original creation date and all intern records.
    link.is_active = False
    db.commit()
    return {'action': 'removed', 'link': _one(db, link.id)}
