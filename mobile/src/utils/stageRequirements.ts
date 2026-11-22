export interface RequirementTerm { academic_year: string; semester: string }
interface Submission { id?: string; document_kind?: string; review_status: string }
interface Onboarding { eligible: boolean; onboarding_approved?: boolean; development_onboarding_bypass?: boolean; orientation: Submission | null; cor: Submission | null }
interface Document extends Partial<RequirementTerm> { id?: string; type: string; verification_status: string; version_status?: string; is_current_approved?: boolean; created_at?: string }
interface Application extends RequirementTerm { id: string; status: string; applied_date: string }
interface ChecklistItem { document_type: string; label: string; required: boolean; status: string }
interface Deployment extends RequirementTerm { id: string; application_id: string; status: string; checklist?: { items: ChecklistItem[]; ready_for_deployment: boolean } | null }
interface Completion extends RequirementTerm {
  deployment_id: string; status: string; company_name?: string; approved_at?: string | null; company_confirmation?: unknown
  checklist?: { approved_hours?: number; required_hours: number | null; ready_to_request: boolean; dtr_count: number; journal_count: number; items: { key: string; label: string; met: boolean }[] }
}
export interface RequirementInput {
  onboarding: Onboarding; term?: RequirementTerm; documents?: Document[]; applications?: Application[]; deployment?: Deployment | null;
  applicationJourney?: { is_current_term: boolean; endorsement: { ready: boolean; status: string } } | null;
  completion?: Completion | null; placements?: (RequirementTerm & { status: string })[]
}
export type RequirementStatus = 'Missing' | 'Pending review' | 'Approved' | 'Rejected' | 'Not started' | 'Needs attention' | 'Provided' | 'Upcoming'
export interface RequirementRow { key: string; label: string; status: RequirementStatus; note?: string }
export interface RequirementPlan { title: string; note: string; rows: RequirementRow[]; action: { label: string; path: string; type?: string; applicationId?: string } }
const sameTerm = (row: Partial<RequirementTerm>, term?: RequirementTerm) => !!term && row.academic_year === term.academic_year && row.semester === term.semester
export function approvedInternship(input: RequirementInput) {
  const { deployment, completion, term } = input
  if (deployment?.status.toLowerCase() !== 'completed' || completion?.status !== 'completed' ||
    completion.deployment_id !== deployment.id || !sameTerm(deployment, term) || !sameTerm(completion, term) ||
    !completion.approved_at || !completion.company_name) return null
  const approvedAt = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(completion.approved_at) ? completion.approved_at : completion.approved_at + 'Z')
  const hours = completion.checklist?.approved_hours
  if (!Number.isFinite(approvedAt.getTime()) || typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) return null
  const date = approvedAt.toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })
  return { id: deployment.id, company: completion.company_name, hours, date }
}
const status = (value?: string): RequirementStatus => ['verified', 'approved'].includes(value || '') ? 'Approved' : ['rejected', 'approval_revoked'].includes(value || '') ? 'Rejected' : value && value !== 'missing' ? 'Pending review' : 'Missing'
export function approvedOnboarding(value: Onboarding) {
  return value.eligible === true && value.onboarding_approved !== false && !(value.onboarding_approved === undefined && value.development_onboarding_bypass) && (['orientation', 'cor'] as const).every(kind => {
    const submission = value[kind]; return !!submission?.id && submission.document_kind === kind && submission.review_status === 'verified'
  })
}
export function selectApplication(input: RequirementInput) {
  const order = ['accepted', 'interview', 'endorsed', 'reviewing', 'pending']
  return (input.applications || []).filter(row => sameTerm(row, input.term) && order.includes(row.status)).sort((a, b) =>
    Number(b.id === input.deployment?.application_id) - Number(a.id === input.deployment?.application_id)
    || order.indexOf(a.status) - order.indexOf(b.status) || b.applied_date.localeCompare(a.applied_date))[0]
}
export function requirementsForStage(input: RequirementInput): RequirementPlan {
  if (!approvedOnboarding(input.onboarding)) return {
    title: 'Complete onboarding', note: 'Get your orientation certificate and current-term COR approved.',
    rows: [{ key: 'orientation', label: 'Orientation certificate', status: status(input.onboarding.orientation?.review_status) }, { key: 'cor', label: 'Current-term COR', status: status(input.onboarding.cor?.review_status) }],
    action: { label: 'View onboarding', path: 'onboarding' },
  }
  const documents = (input.documents || []).filter(doc => sameTerm(doc, input.term))
  const documentRow = (type: string, label: string): RequirementRow => {
    const versions = documents.filter(doc => doc.type === type).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    if (versions.some(doc => doc.is_current_approved && doc.verification_status === 'verified')) return { key: type, label, status: 'Approved', note: versions.some(doc => doc.version_status === 'pending_replacement') ? 'Replacement under review; approved file stays active.' : undefined }
    const latest = versions.find(doc => doc.version_status !== 'superseded')
    return { key: type, label, status: latest?.version_status === 'revoked' ? 'Rejected' : latest?.verification_status === 'verified' ? 'Missing' : status(latest?.verification_status) }
  }
  const deployment = input.deployment && sameTerm(input.deployment, input.term) ? input.deployment : null
  const deploymentStatus = deployment?.status.toLowerCase()
  if (deploymentStatus === 'completed') return { title: 'Internship completed', note: 'Your internship records are read-only.', rows: [], action: { label: 'View archive', path: 'completion' } }
  if (deploymentStatus === 'cancelled') return { title: 'Deployment cancelled', note: 'Contact your coordinator for your next step.', rows: [], action: { label: 'View deployment', path: 'pre-deployment' } }
  if (deploymentStatus === 'deployed') {
    const completion = input.completion
    if (!completion || completion.deployment_id !== deployment!.id || !sameTerm(completion, input.term) || !completion.checklist) throw new Error('Completion checklist unavailable.')
    const checklist = completion.checklist, met = (key: string) => checklist.items.find(item => item.key === key)?.met === true
    if (checklist.ready_to_request) return {
      title: 'Complete your internship', note: 'Your company provides the completion certificate.',
      rows: [{ key: 'company', label: 'Company completion certificate', status: met('company') ? 'Provided' : completion.company_confirmation ? 'Needs attention' : 'Missing' },
        { key: 'coordinator', label: 'Coordinator completion approval', status: completion.status === 'completed' ? 'Approved' : completion.status === 'company_confirmed' ? 'Pending review' : 'Upcoming' }],
      action: { label: completion.status === 'not_requested' ? 'Request completion' : 'View completion', path: 'completion' },
    }
    const rows: RequirementRow[] = [
      { key: 'dtr', label: 'Attendance records', status: met('dtr') ? 'Approved' : checklist.dtr_count ? 'Needs attention' : 'Not started' },
      { key: 'journals', label: 'Weekly journals', status: met('journals') ? 'Approved' : checklist.journal_count ? 'Needs attention' : 'Not started' },
    ]
    const other = checklist.items.filter(item => !['deployment', 'hours', 'dtr', 'journals', 'company'].includes(item.key) && !item.met)
    rows.push(...other.map(item => ({ key: item.key, label: item.key === 'documents' ? 'Pre-deployment documents' : item.key === 'corrections' ? 'Attendance corrections' : item.label, status: 'Needs attention' as const })))
    return { title: 'Keep your internship records up to date', note: checklist.required_hours == null ? 'Required hours are awaiting configuration.' : 'Only fully approved hours count toward completion.', rows,
      action: { label: (other.length > 0 || ['requested', 'company_confirmed', 'returned'].includes(completion.status)) ? 'Review completion' : 'View attendance', path: (other.length > 0 || ['requested', 'company_confirmed', 'returned'].includes(completion.status)) ? 'completion' : 'attendance' } }
  }
  const application = selectApplication(input)
  if (deploymentStatus === 'pre_deployment' || application?.status === 'accepted') {
    const items = deployment?.checklist?.items
    if (!items) return { title: 'Pre-deployment requirements', note: 'Your deployment checklist is being prepared.', rows: [], action: { label: 'View checklist', path: 'pre-deployment' } }
    const rows = items.filter(item => item.required).map(item => ({ key: item.document_type, label: item.label, status: status(item.status) }))
    const missing = rows.find(row => ['Missing', 'Rejected'].includes(row.status))
    return { title: deployment?.checklist?.ready_for_deployment ? 'Await deployment approval' : 'Prepare your pre-deployment documents', note: 'Attendance opens after coordinator approval.', rows,
      action: missing ? { label: 'Upload requirement', path: 'documents', type: missing.key } : { label: 'View checklist', path: 'pre-deployment' } }
  }
  if (application) {
    const journey = input.applicationJourney
    if (!journey?.is_current_term) throw new Error('Application status unavailable.')
    const row: RequirementRow = { key: 'endorsement_letter', label: 'School-issued endorsement letter', status: journey.endorsement.ready ? 'Approved' : status(journey.endorsement.status) }
    const missing = ['Missing', 'Rejected'].includes(row.status)
    return { title: row.status === 'Approved' ? 'Application review' : 'Prepare your endorsement letter', note: row.status === 'Approved' ? 'Track your coordinator and company reviews.' : 'It must be approved before forwarding to the company.', rows: [row],
      action: missing ? { label: 'Upload endorsement', path: 'documents', type: 'endorsement_letter' } : { label: 'View application', path: 'applications', applicationId: application.id } }
  }
  if (input.placements?.some(row => sameTerm(row, input.term) && ['pending', 'released'].includes(row.status))) return { title: 'Review your school-arranged placement', note: 'Follow the requirements listed in your placement.', rows: [], action: { label: 'View placement', path: 'direct-placements' } }
  const rows = [documentRow('resume', 'Resume / CV'), documentRow('application_letter', 'Application letter')]
  const missing = rows.find(row => ['Missing', 'Rejected'].includes(row.status))
  const approved = rows.every(row => row.status === 'Approved')
  return { title: 'Prepare your application documents', note: approved ? 'Your documents are ready. Choose a company.' : 'Upload these documents and wait for approval.', rows,
    action: approved ? { label: 'Find a company', path: 'companies' } : missing ? { label: 'Upload documents', path: 'documents', type: missing.key } : { label: 'View documents', path: 'documents' } }
}

export async function loadRequirementInput(get: <T>(path: string) => Promise<T>): Promise<RequirementInput> {
  const onboarding = await get<Onboarding>('/onboarding/me')
  if (!approvedOnboarding(onboarding)) return { onboarding }
  const term = await get<RequirementTerm>('/academic-requirements/current')
  if (!term.academic_year || !term.semester) throw new Error('Academic term unavailable.')
  const [record, documents] = await Promise.all([get<{ deployment: Deployment | null }>('/deployments/my'), get<Document[]>('/documents/?current_term_only=true')])
  async function list<T>(path: string) {
    const rows: T[] = []
    for (let page = 1; ; page++) {
      const result = await get<{ items: T[]; total: number }>(`${path}?page=${page}&limit=100`)
      rows.push(...result.items)
      if (!result.items.length || rows.length >= result.total) return rows
    }
  }
  const input: RequirementInput = { onboarding, term, documents, deployment: record.deployment }
  const validDeployment = record.deployment && sameTerm(record.deployment, term)
  const state = validDeployment ? record.deployment!.status.toLowerCase() : null
  if (state === 'deployed' || state === 'completed') {
    input.completion = await get<Completion>(`/completion/${encodeURIComponent(record.deployment!.id)}`).catch(error => {
      if (state === 'completed') return null
      throw error
    })
  }
  if (!validDeployment) {
    input.applications = await list<Application>('/applications/')
    const application = selectApplication(input)
    if (application && application.status !== 'accepted') input.applicationJourney = await get<RequirementInput['applicationJourney']>(`/applications/${encodeURIComponent(application.id)}/journey`)
    if (!application) input.placements = await list<RequirementTerm & { status: string }>('/direct-placements')
  }
  return input
}
