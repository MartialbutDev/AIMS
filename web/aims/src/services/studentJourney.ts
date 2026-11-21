import { isApprovedStudentOnboarding } from './studentOnboardingAccess.ts'
import type { Application, Deployment, Journey, Onboarding, Placement, StudentDocument } from './studentService'
import type { CompletionRecord } from './completionService'

export const internshipSteps = ['Onboarding', 'Application', 'Pre-deployment', 'Internship', 'Completion'] as const
export interface JourneyTerm { academic_year: string; semester: string }
export interface JourneySnapshot {
  onboarding: Onboarding; term?: JourneyTerm; applications?: Application[]; documents?: StudentDocument[]
  deployment?: Deployment | null; applicationJourney?: Journey | null; completion?: CompletionRecord | null
  placements?: Placement[]
}
export interface JourneyProgress { current: number; complete: boolean; message: string; action: string; path: string }
const at = (current: number, message: string, action: string, path: string, complete = false): JourneyProgress => ({ current, complete, message, action, path })
const sameTerm = (row: JourneyTerm, term?: JourneyTerm) => !!term && row.academic_year === term.academic_year && row.semester === term.semester
export function currentApplication(applications: Application[], term: JourneyTerm, deployment?: Deployment | null) {
  const order = ['accepted', 'interview', 'endorsed', 'reviewing', 'pending']
  return applications.filter(app => sameTerm(app, term) && order.includes(app.status))
    .sort((a, b) => Number(b.id === deployment?.application_id) - Number(a.id === deployment?.application_id)
      || order.indexOf(a.status) - order.indexOf(b.status) || b.applied_date.localeCompare(a.applied_date) || a.id.localeCompare(b.id))[0] || null
}
export function studentJourney(snapshot: JourneySnapshot): JourneyProgress {
  if (!isApprovedStudentOnboarding(snapshot.onboarding)) {
    const orientation = snapshot.onboarding.orientation
    const message = !orientation ? 'Upload your orientation certificate and current-term COR.'
      : orientation.review_status !== 'verified' ? 'Your orientation certificate needs approval.'
      : snapshot.onboarding.cor?.review_status === 'verified' ? 'Your onboarding is awaiting approval.' : 'Submit your current-term COR and wait for approval.'
    return at(0, message, 'View onboarding', 'onboarding')
  }
  const { term } = snapshot
  const deployment = snapshot.deployment && sameTerm(snapshot.deployment, term) ? snapshot.deployment : null
  const application = term ? currentApplication(snapshot.applications || [], term, deployment) : null
  if (deployment?.status === 'completed') return at(4, 'Your internship is complete.', 'View archive', 'completion', true)
  if (deployment?.status === 'deployed') {
    const completion = snapshot.completion?.deployment_id === deployment.id && sameTerm(snapshot.completion, term) ? snapshot.completion : null
    if (!completion?.checklist) throw new Error('The completion checklist is unavailable.')
    if (completion.checklist.ready_to_request) {
      if (completion.status === 'company_confirmed') return at(4, 'Company confirmed. Awaiting coordinator approval.', 'View completion', 'completion')
      if (completion.status === 'requested') return at(4, 'Completion requested. Awaiting company confirmation.', 'View completion', 'completion')
      if (completion.status === 'returned') return at(4, 'Your completion request needs updates.', 'Review completion', 'completion')
      return at(4, 'Your requirements are ready for completion review.', 'Request completion', 'completion')
    }
    if (['requested', 'company_confirmed', 'returned'].includes(completion.status)) return at(3, 'Resolve the completion checklist before approval.', 'Review completion', 'completion')
    if (completion.checklist.required_hours == null) return at(3, 'Record attendance and journals. Required hours are awaiting configuration.', 'View attendance', 'attendance')
    return at(3, 'Keep your attendance and weekly journals up to date.', 'View attendance', 'attendance')
  }
  if (deployment?.status === 'cancelled') return at(2, 'Your deployment was cancelled. Contact your coordinator.', 'View deployment', 'pre-deployment')
  if (deployment?.status === 'pre_deployment' || application?.status === 'accepted') {
    return at(2, deployment?.checklist?.ready_for_deployment ? 'Requirements met. Awaiting deployment approval.' : 'Complete your pre-deployment requirements.', 'View checklist', 'pre-deployment')
  }
  if (application) {
    const path = `applications?id=${encodeURIComponent(application.id)}`
    const journey = snapshot.applicationJourney
    if (!journey || !journey.is_current_term || !sameTerm(journey, term)) throw new Error('Application progress changed. Refresh to check your current term.')
    if (journey.stage === 'upload_endorsement') return at(1, 'Upload your school-issued endorsement letter.', 'Upload endorsement', 'documents?type=endorsement_letter')
    if (journey.stage === 'endorsement_review') return at(1, 'Your endorsement letter is awaiting review.', 'View application', path)
    if (journey.stage === 'company_review') return at(1, 'Your application is awaiting the company’s decision.', 'View application', path)
    return at(1, 'Your application is awaiting coordinator review.', 'View application', path)
  }
  if (snapshot.placements?.some(placement => sameTerm(placement, term) && ['pending', 'released'].includes(placement.status))) return at(1, 'Review your school-arranged placement.', 'View placement', 'direct-placements')
  const approved = (kind: string) => snapshot.documents?.some(doc => doc.type === kind && doc.is_current_approved && doc.academic_year === term?.academic_year && doc.semester === term?.semester)
  if (!approved('resume') || !approved('application_letter')) return at(1, 'Prepare your approved resume and application letter.', 'View documents', 'documents')
  return at(1, 'Choose a partner company and submit your application.', 'Find a company', 'companies')
}
