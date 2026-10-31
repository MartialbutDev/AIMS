
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

    @classmethod
    def get_approval(cls, db: Session, deployment, actor: User):
        """One read-only eligibility snapshot, also rechecked by confirmation."""
        from app.models.company import Company
        from app.services import direct_placement_service as direct_service
        year, semester = get_current_academic_term()
        checks = []
        def check(code, label, passed):
            checks.append({"code": code, "label": label, "passed": bool(passed)})
        can_approve = actor.role == UserRole.COORDINATOR
        if can_approve:
            try:
                ensure_coordinator_student_access(db, actor, deployment.student_id,
                    academic_year=deployment.academic_year, semester=deployment.semester, mode="write")
            except HTTPException as error:
                if error.status_code not in (403, 404): raise
                can_approve = False
        check('authority', 'Active coordinator designation and current-term student assignment', can_approve)
        check('term', 'Deployment belongs to the current academic term',
              (deployment.academic_year, deployment.semester) == (year, semester))
        check('status', 'Awaiting official deployment confirmation', deployment.status == DeploymentStatus.PRE_DEPLOYMENT)
        student = db.get(User, deployment.student_id)
        check('student', 'Student account is active', student and student.is_active and student.role == UserRole.STUDENT)
        application = db.get(Application, deployment.application_id)
        matches = application and application.status == ApplicationStatus.ACCEPTED and (
            application.student_id, application.company_id, application.academic_year, application.semester
        ) == (deployment.student_id, deployment.company_id, deployment.academic_year, deployment.semester)
        check('acceptance', 'Company accepted the matching internship application', matches)
        conflict = db.query(InternshipDeployment.id).filter(
            InternshipDeployment.student_id == deployment.student_id,
            InternshipDeployment.academic_year == deployment.academic_year,
            InternshipDeployment.semester == deployment.semester,
            InternshipDeployment.id != deployment.id,
            InternshipDeployment.status != DeploymentStatus.CANCELLED).first()
        check('unique', 'No conflicting internship deployment in this term', not conflict)
        company = db.get(Company, deployment.company_id)
        moa = direct_service.moa_state(company)
        for item in moa['checks']:
            check('moa', item['label'], item['passed'])
        direct = None
        if direct_service.available(db):
            from app.models.direct_placement import DirectPlacement
            direct = db.query(DirectPlacement).filter(DirectPlacement.application_id == deployment.application_id).first()
        if direct:
            cleared = True
            try:
                direct_service.ensure_application_ready(db, application) if application else None
                cleared = bool(application)
            except HTTPException as error:
                if error.status_code != 409: raise
                cleared = False
            check('direct', 'Direct placement has student acknowledgement, partnership clearance and valid coordinator assignment', cleared)
        checklist = cls.get_checklist(db, deployment)
        check('documents', 'All required pre-deployment documents are verified', checklist['ready_for_deployment'])
        dates = [value for value in [company.moa_signed_at if company else None,
                 company.moa_effective_at if company else None] if value]
        if application and application.decided_at:
            dates.append((application.decided_at.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=8)))).date())
        if direct and direct.student_decided_at:
            dates.append((direct.student_decided_at.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=8)))).date())
        today = datetime.now(timezone(timedelta(hours=8))).date()
        minimum = max(dates) if dates else None
        maximum = min(today, company.moa_expires_at) if company and company.moa_expires_at else today
        check('dates', 'An eligible deployment date is available', not minimum or minimum <= maximum)
        approver = db.get(User, deployment.confirmed_by) if deployment.confirmed_by else None
        return {
            'checks': checks, 'ready': all(item['passed'] for item in checks),
            'blockers': [item['label'] for item in checks if not item['passed']],
            'checklist': checklist, 'source': 'direct_placement' if direct else 'regular_application',
            'company_name': company.name if company else 'Company unavailable',
            'position': application.position if application else None,
            'minimum_date': minimum, 'maximum_date': maximum,
            'confirmed_by_name': ' '.join(filter(None, [approver.first_name, approver.last_name])) if approver else None,
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

        approval = cls.get_approval(db, deployment, actor)
        if not approval['ready']:
            raise HTTPException(409, detail={
                'message': 'Deployment approval requirements are incomplete',
                'blockers': approval['blockers'],
            })
        if ((approval['minimum_date'] and deployment_date < approval['minimum_date'])
                or deployment_date > approval['maximum_date']):
            raise HTTPException(422, 'Deployment date must follow MOA effectivity, company acceptance and any student acknowledgement, and cannot be in the future or after MOA expiry')

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
