
from typing import Annotated, List
from datetime import datetime, timezone, timedelta
from app.services.direct_placement_service import moa_state

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.services import company_intake as intake_service
from app.services.excel_service import ExcelExportService
from app.models.company import Company
from app.models.user import User
from app.schemas.company import (
    CompanyCreate,
    CompanyResponse,
    CompanyIntakeSummary,
    CompanyUpdate,
)

router = APIRouter()

def with_intakes(db, rows):
    states = intake_service.summaries(db, rows)
    return [CompanyResponse.model_validate(row).model_copy(update={"intake": CompanyIntakeSummary.model_validate(states[row.id])}) for row in rows]


COMPANY_MANAGER_ROLES = {"admin", "career_center"}
MOA_EXPIRING_WITHIN_DAYS = 90


# ============================================================
# ROLE AND PERMISSION HELPERS
# ============================================================

def get_user_role(user: User) -> str:
    """
    Normalize string or Enum role values.
    """
    role = getattr(user.role, "value", user.role)
    return str(role).strip().lower()


def is_company_manager(user: User) -> bool:
    return get_user_role(user) in COMPANY_MANAGER_ROLES


def require_company_manager(
    current_user: User = Depends(get_current_user),
) -> User:
    if not is_company_manager(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage companies.",
        )

    return current_user


# ============================================================
# VALIDATION HELPERS
# ============================================================

def validate_moa_dates(company: Company) -> None:
    """
    Validate the dates of a signed MOA.

    An expired MOA can remain marked as signed because
    the signed flag represents an agreement having been
    executed, not whether it is currently valid.
    """
    if not company.is_moa_signed:
        return

    if (
        company.moa_effective_at is not None
        and company.moa_expires_at is not None
        and company.moa_expires_at < company.moa_effective_at
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "MOA expiration date cannot be earlier "
                "than its effective date."
            ),
        )

    if (
        company.moa_signed_at is not None
        and company.moa_expires_at is not None
        and company.moa_expires_at < company.moa_signed_at
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "MOA expiration date cannot be earlier "
                "than its signing date."
            ),
        )


def normalize_moa_state(company: Company) -> None:
    """
    Keep the current MOA record internally consistent.

    Unsigned agreements cannot retain signed-agreement
    dates. The reference may be retained for a draft
    or pending agreement.
    """
    if not company.is_moa_signed:
        company.moa_signed_at = None
        company.moa_effective_at = None
        company.moa_expires_at = None

    validate_moa_dates(company)


def sync_notarization_date(company: Company) -> None:
    if company.moa_notarized_at is not None:
        company.moa_notarized = True
        company.moa_notarized_year = company.moa_notarized_at.year


def check_duplicate_name(
    db: Session,
    name: str,
    exclude_id: str | None = None,
) -> None:
    query = db.query(Company).filter(
        func.lower(Company.name) == name.lower()
    )

    if exclude_id is not None:
        query = query.filter(Company.id != exclude_id)

    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company with this name already exists.",
        )


def get_company_or_404(
    db: Session,
    company_id: str,
) -> Company:
    company = (
        db.query(Company)
        .filter(Company.id == company_id)
        .first()
    )

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    return company


# ============================================================
# COMPANY DIRECTORY
# ============================================================

@router.get("/", response_model=List[CompanyResponse])
async def get_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Public-to-authenticated-users company directory.

    Only active companies are returned.
    """
    rows = (
        db.query(Company)
        .filter(Company.is_active.is_(True))
        .order_by(Company.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return with_intakes(db, rows)


@router.get("/manage", response_model=List[CompanyResponse])
async def get_manageable_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_manager),
):
    """
    Management directory.

    Includes active and inactive companies.
    Only admin and career_center may access it.
    """
    rows = (
        db.query(Company)
        .order_by(Company.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return with_intakes(db, rows)


@router.get("/all", response_model=List[CompanyResponse])
async def get_all_companies_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Backward-compatible administrator directory.
    """
    rows = (
        db.query(Company)
        .order_by(Company.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return with_intakes(db, rows)


@router.post("/export")
def export_company_directory(
    company_ids: Annotated[list[Annotated[str, Field(min_length=1, max_length=36)]], Body(embed=True, min_length=1)],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_manager),
):
    """Export the records selected by the Career Center directory filters."""
    ids = list(dict.fromkeys(company_ids))
    companies = {}
    for start in range(0, len(ids), 500):
        rows = db.query(Company).filter(Company.id.in_(ids[start:start + 500])).all()
        companies.update((company.id, company) for company in rows)
    if len(companies) != len(ids):
        raise HTTPException(409, "The company directory changed. Refresh it and export again.")

    workbook = ExcelExportService.generate_company_directory([companies[company_id] for company_id in ids])
    return Response(
        content=workbook.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="Registered Partner Companies.xlsx"',
            "Cache-Control": "no-store",
        },
    )


# ============================================================
# COMPANY DETAILS — PRIVACY PROTECTION
# ============================================================

@router.get("/dean-directory")
async def get_dean_partner_directory(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("dean")),
):
    """Read-only directory of active partnerships, using the placement MOA checks."""
    today = datetime.now(timezone(timedelta(hours=8))).date()
    candidates = db.query(Company).filter(Company.is_active.is_(True), Company.is_moa_signed.is_(True))
    # Apply the shared readiness rules before counting or slicing pages.
    partners = [company for company in candidates.order_by(Company.name.asc(), Company.id.asc()).all()
                if moa_state(company)['ready']]
    total = len(partners)
    items = []
    for company in partners[skip:skip + limit]:
        state = moa_state(company)
        days = (company.moa_expires_at - today).days
        status = 'expiring' if days <= MOA_EXPIRING_WITHIN_DAYS else 'current'
        items.append({**CompanyResponse.model_validate(company).model_dump(mode='json'),
                      'moa_status': status, 'moa_ready': state['ready'],
                      'days_to_expiry': days, 'checks': state['checks']})
    return {'items': items, 'total': total, 'as_of': today.isoformat()}


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Access rules:
    - Active company: any authenticated user
    - Inactive company: admin or career_center only

    Unauthorized users receive 404 for inactive
    companies to avoid revealing their existence.
    """
    company = get_company_or_404(db, company_id)

    if not company.is_active and not is_company_manager(current_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    return with_intakes(db, [company])[0]


# ============================================================
# CREATE COMPANY
# ============================================================

@router.post(
    "/",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_manager),
):
    """
    Register a new company.

    Only admin and career_center can register companies.
    """
    intake_service.require_schema(db)
    payload = company_data.model_dump()
    capacity = payload.pop("intern_capacity")
    payload["name"] = payload["name"].strip()

    if len(payload["name"]) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Company name must contain at least two characters.",
        )

    check_duplicate_name(db, payload["name"])

    company = Company(**payload)

    # Unsigned agreements cannot retain signed MOA dates.
    normalize_moa_state(company)
    sync_notarization_date(company)

    try:
        db.add(company)
        db.flush()
        intake_service.record_capacity(db, company, current_user, capacity)
        db.commit()
        db.refresh(company)
    except Exception:
        db.rollback()
        raise

    return with_intakes(db, [company])[0]


# ============================================================
# UPDATE COMPANY
# ============================================================

@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_company_manager),
):
    """
    Update company details, activation, and MOA records.

    Only admin and career_center can update companies.
    """
    company = intake_service.company(db, company_id, lock=True)

    updates = company_data.model_dump(exclude_unset=True)
    has_capacity = "intern_capacity" in updates
    capacity = updates.pop("intern_capacity", None)
    version = updates.pop("intake_version", None)
    has_accepting = "accepting_interns" in updates
    accepting = updates.pop("accepting_interns", None)
    intake_year = updates.pop("intake_academic_year", None)
    intake_semester = updates.pop("intake_semester", None)
    if has_capacity and (capacity is None or version is None):
        raise HTTPException(422, "Provide a positive intern capacity and its current version.")
    if has_accepting and (accepting is None or not has_capacity or not intake_year or not intake_semester):
        raise HTTPException(422, "Provide the intake term, capacity and version when changing application availability.")

    if "name" in updates:
        if updates["name"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Company name cannot be empty.",
            )

        updates["name"] = updates["name"].strip()

        if len(updates["name"]) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Company name must contain at least two characters.",
            )

        check_duplicate_name(
            db,
            updates["name"],
            exclude_id=company.id,
        )

    for key, value in updates.items():
        setattr(company, key, value)

    # Prevent unsigned MOAs from retaining signed dates.
    normalize_moa_state(company)
    sync_notarization_date(company)

    try:
        if has_capacity:
            db.flush()
            intake_service.record_capacity(
                db, company, current_user, capacity, version, accepting=accepting,
                expected_term=(intake_year, intake_semester) if has_accepting else None,
            )
        db.commit()
        db.refresh(company)
    except Exception:
        db.rollback()
        raise

    return with_intakes(db, [company])[0]


# ============================================================
# DELETE COMPANY — ADMIN ONLY
# ============================================================

@router.delete("/{company_id}")
async def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Permanently delete a company.

    Restricted to administrators.
    """
    company = get_company_or_404(db, company_id)

    try:
        from app.models.moa_file import MoaFile
        if db.query(MoaFile.id).filter_by(company_id=company_id).first():
            raise HTTPException(409, "Companies with retained MOA files cannot be deleted. Deactivate the company instead.")
        db.delete(company)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Company deleted successfully."}
