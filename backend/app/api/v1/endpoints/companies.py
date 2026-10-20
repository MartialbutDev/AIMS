
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.company import Company
from app.models.user import User
from app.schemas.company import (
    CompanyCreate,
    CompanyResponse,
    CompanyUpdate,
)

router = APIRouter()

COMPANY_MANAGER_ROLES = {"admin", "career_center"}


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
    return (
        db.query(Company)
        .filter(Company.is_active.is_(True))
        .order_by(Company.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


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
    return (
        db.query(Company)
        .order_by(Company.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


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
    return (
        db.query(Company)
        .order_by(Company.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ============================================================
# COMPANY DETAILS — PRIVACY PROTECTION
# ============================================================

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

    return company


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
    payload = company_data.model_dump()
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

    try:
        db.add(company)
        db.commit()
        db.refresh(company)
    except Exception:
        db.rollback()
        raise

    return company


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
    company = get_company_or_404(db, company_id)

    updates = company_data.model_dump(exclude_unset=True)

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

    try:
        db.commit()
        db.refresh(company)
    except Exception:
        db.rollback()
        raise

    return company


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
        db.delete(company)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Company deleted successfully."}
