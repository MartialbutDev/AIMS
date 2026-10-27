
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.assignment_access import (
    ensure_coordinator_student_access,
    get_current_academic_term,
)
from app.models.application import Application, ApplicationStatus
from app.models.document import Document, DocumentType
from app.models.internship_deployment import (
    InternshipDeployment,
    DeploymentStatus,
)
from app.models.user import User, UserRole


class DeploymentService:
    # Initial checklist. Confirm final mandatory documents
    # against CITC's approved internship requirements.
    REQUIRED_DOCUMENTS = {
        DocumentType.WAIVER: "Waiver",
        DocumentType.MEDICAL_CERTIFICATE: "Medical Certificate",
        DocumentType.INTERNSHIP_PLAN: "Internship Plan",
    }

    @staticmethod
    def _enum_value(value):
        return getattr(value, "value", value)

    @classmethod
    def get_checklist(cls, db: Session, deployment):
        documents = (
            db.query(Document)
            .filter(
                Document.uploaded_by == deployment.student_id,
                Document.academic_year == deployment.academic_year,
                Document.semester == deployment.semester,
                Document.type.in_(list(cls.REQUIRED_DOCUMENTS)),
            )
            .order_by(
                Document.created_at.desc(),
                Document.id.desc(),
            )
            .all()
        )

        # The latest submission determines the status of each
        # requirement. Older verified files cannot silently
        # override a newer pending or rejected replacement.
        latest = {}
        for document in documents:
            if document.type not in latest:
                latest[document.type] = document

        checklist = []

        for document_type, label in cls.REQUIRED_DOCUMENTS.items():
            document = latest.get(document_type)

            checklist.append({
                "document_type": document_type.value,
                "label": label,
                "required": True,
                "document_id": document.id if document else None,
                "status": (
                    cls._enum_value(document.verification_status)
                    if document
                    else "missing"
                ),
            })

        ready = all(
            item["status"] == "verified"
            for item in checklist
        )

        return {
            "items": checklist,
            "ready_for_deployment": ready,
        }

    @staticmethod
    def create_for_accepted_application(
        db: Session,
        application: Application,
    ) -> InternshipDeployment:
        """
        Adds the deployment to the current transaction.
        The caller must commit the application and deployment
        together.
        """
        if application.status != ApplicationStatus.ACCEPTED:
            raise HTTPException(
                status_code=409,
                detail="Application must be accepted first",
            )

        year, semester = get_current_academic_term()

        if (
            application.academic_year != year
            or application.semester != semester
        ):
            raise HTTPException(
                status_code=403,
                detail="Application is not in the current term",
            )

        existing = (
            db.query(InternshipDeployment)
            .filter(
                InternshipDeployment.application_id == application.id
            )
            .first()
        )

        if existing:
            return existing

        deployment = InternshipDeployment(
            id=str(uuid.uuid4()),
            application_id=application.id,
            student_id=application.student_id,
            company_id=application.company_id,
            academic_year=application.academic_year,
            semester=application.semester,
            status=DeploymentStatus.PRE_DEPLOYMENT,
        )

        db.add(deployment)
        db.flush()

        return deployment

    @classmethod
    def confirm_deployment(
        cls,
        db: Session,
        deployment_id: str,
        actor: User,
        deployment_date: date,
    ) -> InternshipDeployment:
        if actor.role != UserRole.COORDINATOR:
            raise HTTPException(
                status_code=403,
                detail="Coordinator role required",
            )

        identity = db.query(InternshipDeployment.student_id).filter(InternshipDeployment.id == deployment_id).first()
        if identity:
            db.query(User).filter(User.id == identity[0]).with_for_update().first()
        deployment = (
            db.query(InternshipDeployment).populate_existing()
            .filter(
                InternshipDeployment.id == deployment_id
            )
            .with_for_update()
            .first()
        )

        if deployment is None:
            raise HTTPException(
                status_code=404,
                detail="Deployment not found",
            )

        year, semester = get_current_academic_term()

        if (
            deployment.academic_year != year
            or deployment.semester != semester
        ):
            raise HTTPException(
                status_code=403,
                detail="Historical deployments are read-only",
            )

        ensure_coordinator_student_access(
            db,
            actor,
            deployment.student_id,
            academic_year=year,
            semester=semester,
            mode="write",
        )

        if deployment.status != DeploymentStatus.PRE_DEPLOYMENT:
            raise HTTPException(
                status_code=409,
                detail="Deployment is not awaiting confirmation",
            )

        application = (
            db.query(Application)
            .filter(
                Application.id == deployment.application_id
            )
            .first()
        )

        if (
            application is None
            or application.status != ApplicationStatus.ACCEPTED
            or application.student_id != deployment.student_id
            or application.company_id != deployment.company_id
            or application.academic_year != year
            or application.semester != semester
        ):
            raise HTTPException(
                status_code=409,
                detail="Deployment does not match an accepted application",
            )

        from app.services import direct_placement_service as direct_service
        direct_service.ensure_application_ready(db, application)
        if direct_service.available(db):
            from app.models.direct_placement import DirectPlacement
            direct = db.query(DirectPlacement).filter(DirectPlacement.application_id == application.id).first()
            if direct:
                from app.models.company import Company
                company = db.query(Company).filter(Company.id == application.company_id).one()
                earliest = max(company.moa_signed_at, company.moa_effective_at,
                    (direct.student_decided_at + timedelta(hours=8)).date(),
                    (application.decided_at + timedelta(hours=8)).date() if application.decided_at else date.min)
                if deployment_date < earliest or deployment_date > company.moa_expires_at:
                    raise HTTPException(422, 'The deployment date must follow student acknowledgement, company acceptance and MOA effectivity')

        checklist = cls.get_checklist(db, deployment)

        if not checklist["ready_for_deployment"]:
            missing = [
                item["label"]
                for item in checklist["items"]
                if item["status"] != "verified"
            ]

            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Required documents are not verified",
                    "incomplete_requirements": missing,
                },
            )

        if deployment_date > datetime.now(timezone(timedelta(hours=8))).date():
            raise HTTPException(
                status_code=422,
                detail="Deployment date cannot be in the future",
            )

        deployment.status = DeploymentStatus.DEPLOYED
        deployment.confirmed_by = actor.id
        deployment.confirmed_at = datetime.utcnow()
        deployment.deployment_date = deployment_date

        db.commit()
        db.refresh(deployment)

        return deployment

    @staticmethod
    def require_active_deployment(
        db: Session,
        student_id: str,
    ) -> InternshipDeployment:
        year, semester = get_current_academic_term()

        deployment = (
            db.query(InternshipDeployment)
            .filter(
                InternshipDeployment.student_id == student_id,
                InternshipDeployment.academic_year == year,
                InternshipDeployment.semester == semester,
                InternshipDeployment.status == DeploymentStatus.DEPLOYED,
                InternshipDeployment.confirmed_by.isnot(None),
                InternshipDeployment.confirmed_at.isnot(None),
                InternshipDeployment.deployment_date.isnot(None),
            )
            .first()
        )

        if deployment is None:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Official internship deployment is required "
                    "before submitting DTR or journals"
                ),
            )

        return deployment
