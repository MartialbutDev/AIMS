"""Dean oversight of college-wide admin designations and legacy Dean records."""
from sqlalchemy import or_, select
from app.models.user import User, UserRole
from app.models.dean_coordinator_designation import DeanCoordinatorDesignation as Designation


def dean_designation_scope(dean_id):
    administrators = select(User.id).where(User.role == UserRole.ADMIN)
    return or_(Designation.assigned_by_dean_id == dean_id,
               Designation.assigned_by_dean_id.in_(administrators))
