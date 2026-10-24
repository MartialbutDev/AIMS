
import { getDashboardAnalytics } from './analyticsService'
import { apiRequest, apiRequestBlob } from './apiClient'
import type { DashboardData } from '../types/dashboard'

// ============================================================
// COORDINATOR STUDENT TYPES
// ============================================================

export interface CoordinatorStudent {
  id: string
  student_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  is_active: boolean
  documents_verified: number
  documents_required: number
  documents_progress_percent: number
  application_count: number
  application_statuses: Record<string, number>
  journey: CoordinatorJourney
  grade: number | null
}

export interface CoordinatorJourney {
  required_hours: number
  approved_hours: number
  remaining_hours: number
  progress_percent: number
  remaining_percent: number
  average_approved_hours_per_day: number | null
  estimated_days_left: number | null
  approved_dtr_count: number
  pending_dtr_count: number
  rejected_dtr_count: number
}

export interface CoordinatorStudentDetail {
  student: Pick<
    CoordinatorStudent,
    | 'id'
    | 'student_id'
    | 'first_name'
    | 'last_name'
    | 'email'
    | 'phone'
    | 'is_active'
  >

  journey: CoordinatorJourney

  document_statuses: Array<{
    type: string
    status: string
  }>

  documents: Array<{
    id: string
    type: string
    filename: string | null
    status: string
    created_at: string
  }>

  applications: Array<{
    id: string
    position: string
    company: string | null
    status: string
    applied_date: string
  }>

  dtr_records: Array<{
    id: string
    date: string
    time_in: string
    time_out: string | null
    total_hours: number | null
    status: string
    tasks_completed: string | null
    notes: string | null
    image_in_available: boolean
    image_out_available: boolean
  }>

  journals: Array<{
    id: string
    week: number
    title: string
    status: string
    summary: string | null
  }>

  evaluation: {
    grade: number
    notes: string | null
    updated_at: string
  } | null
}

export interface StudentPage {
  items: CoordinatorStudent[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// ============================================================
// HISTORICAL COORDINATOR ASSIGNMENTS
// ============================================================

export interface HistoricalCoordinatorStudent {
  assignment_id: string
  student_id: string
  student_number: string | null
  first_name: string
  last_name: string
  email: string
  academic_year: string
  semester: string
  read_only: boolean
}

export interface HistoricalCoordinatorStudentsResponse {
  items: HistoricalCoordinatorStudent[]
}

export function getCoordinatorHistoricalStudents():
  Promise<HistoricalCoordinatorStudentsResponse> {
  return apiRequest<HistoricalCoordinatorStudentsResponse>(
    '/api/v1/coordinator/historical-students',
  )
}

// ============================================================
// COORDINATOR DASHBOARD
// ============================================================

export function getCoordinatorDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}

// ============================================================
// CURRENT-SEMESTER STUDENTS
// ============================================================

export function getCoordinatorStudents(
  page: number,
  search: string,
): Promise<StudentPage> {
  const params = new URLSearchParams({
    page: String(page),
    limit: '100',
  })

  if (search.trim()) {
    params.set('search', search.trim())
  }

  return apiRequest<StudentPage>(
    `/api/v1/coordinator/students?${params.toString()}`,
  )
}

export function getCoordinatorStudentDetail(
  studentId: string,
): Promise<CoordinatorStudentDetail> {
  return apiRequest<CoordinatorStudentDetail>(
    `/api/v1/coordinator/students/${encodeURIComponent(studentId)}`,
  )
}

export function saveCoordinatorEvaluation(
  studentId: string,
  grade: number,
  notes: string,
): Promise<{
  grade: number
  notes: string | null
  updated_at: string
}> {
  return apiRequest(
    `/api/v1/coordinator/students/${encodeURIComponent(studentId)}/evaluation`,
    {
      method: 'PUT',
      body: JSON.stringify({
        grade,
        notes: notes || null,
      }),
    },
  )
}

export async function getCoordinatorStudentFile(
  studentId: string,
  filePath: string,
): Promise<{
  url: string
  contentType: string
}> {
  const blob = await apiRequestBlob(
    `/api/v1/coordinator/students/${encodeURIComponent(studentId)}/${filePath}`,
  )

  return {
    url: URL.createObjectURL(blob),
    contentType: blob.type,
  }
}

// ============================================================
// COORDINATOR REVIEW QUEUE TYPES
// ============================================================

export interface CoordinatorReviewApplication {
  id: string
  student_id: string
  student_name: string
  company_name: string | null
  position: string
  status: string
  applied_date: string
}

export interface CoordinatorReviewDtr {
  id: string
  student_id: string
  student_name: string
  date: string
  time_in: string
  time_out: string | null
  total_hours: number | null
  status: string
  tasks_completed: string | null
  image_in_available: boolean
  image_out_available: boolean
}

export interface CoordinatorReviewJournal {
  id: string
  student_id: string
  student_name: string
  week: number
  title: string
  summary: string | null
  status: string
}

export interface CoordinatorReviewQueue {
  applications: CoordinatorReviewApplication[]
  dtrs: CoordinatorReviewDtr[]
  journals: CoordinatorReviewJournal[]
}

export type ApplicationReviewStatus =
  | 'reviewing'
  | 'interview'
  | 'accepted'
  | 'rejected'

export type RecordReviewStatus =
  | 'approved'
  | 'rejected'

// ============================================================
// COORDINATOR REVIEW QUEUE REQUESTS
// ============================================================

export function getCoordinatorReviewQueue():
  Promise<CoordinatorReviewQueue> {
  return apiRequest<CoordinatorReviewQueue>(
    '/api/v1/coordinator/review-queue?limit=200',
  )
}

export function reviewCoordinatorApplication(
  id: string,
  status: ApplicationReviewStatus,
): Promise<{
  id: string
  status: string
}> {
  return apiRequest(
    `/api/v1/coordinator/review-queue/applications/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ status }),
    },
  )
}

export function reviewCoordinatorDtr(
  id: string,
  status: RecordReviewStatus,
): Promise<{
  id: string
  status: string
}> {
  return apiRequest(
    `/api/v1/coordinator/review-queue/dtrs/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ status }),
    },
  )
}

export function reviewCoordinatorJournal(
  id: string,
  status: RecordReviewStatus,
): Promise<{
  id: string
  status: string
}> {
  return apiRequest(
    `/api/v1/coordinator/review-queue/journals/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ status }),
    },
  )
}

export async function getCoordinatorJournalFile(
  studentId: string,
  journalId: string,
): Promise<{
  url: string
  contentType: string
}> {
  const blob = await apiRequestBlob(
    `/api/v1/coordinator/students/${encodeURIComponent(studentId)}/journals/${encodeURIComponent(journalId)}/file`,
  )

  return {
    url: URL.createObjectURL(blob),
    contentType: blob.type,
  }
}

// ============================================================
// COORDINATOR ONBOARDING DOCUMENT VERIFICATION
// ============================================================
//
// Existing Orientation Certificate and COR functionality.
// Preserved for compatibility with the Administrator Portal.
// ============================================================

export interface OnboardingSubmission {
  id: string
  document_kind: string
  original_filename: string
  review_status: string

  validation_result: {
    automatic_result?: string
    reasons?: string[]
    ocr_warning?: string
    details?: Record<string, unknown>
    [key: string]: unknown
  } | null

  review_notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

export interface CoordinatorOnboardingQueueItem {
  student: {
    id: string
    student_id: string | null
    name: string
  }

  onboarding: {
    student_id: string
    eligible: boolean
    next_step: string

    orientation: OnboardingSubmission | null
    cor: OnboardingSubmission | null

    coordinator_assignment: {
      status: string
      coordinator_id?: string
      coordinator_name?: string
    }
  }
}

// ============================================================
// GET PENDING ONBOARDING VERIFICATION QUEUE
// ============================================================

export function getCoordinatorOnboardingQueue():
  Promise<CoordinatorOnboardingQueueItem[]> {
  return apiRequest<CoordinatorOnboardingQueueItem[]>(
    '/api/v1/onboarding/verification-queue',
  )
}

// ============================================================
// PREVIEW STUDENT ONBOARDING DOCUMENT
// ============================================================

export async function getCoordinatorOnboardingFile(
  submissionId: string,
): Promise<{
  url: string
  contentType: string
}> {
  const blob = await apiRequestBlob(
    `/api/v1/onboarding/submissions/${encodeURIComponent(submissionId)}/file`,
  )

  return {
    url: URL.createObjectURL(blob),
    contentType: blob.type,
  }
}

// ============================================================
// APPROVE OR REJECT ONBOARDING DOCUMENT
// ============================================================

export function reviewCoordinatorOnboardingSubmission(
  submissionId: string,
  decision: 'verified' | 'rejected',
  notes: string,
): Promise<CoordinatorOnboardingQueueItem['onboarding']> {
  return apiRequest<CoordinatorOnboardingQueueItem['onboarding']>(
    `/api/v1/onboarding/submissions/${encodeURIComponent(submissionId)}/review`,
    {
      method: 'PUT',
      body: JSON.stringify({
        decision,
        notes: notes.trim() || null,
      }),
    },
  )
}

// ============================================================
// COORDINATOR INTERNSHIP DOCUMENT REVIEW
// ============================================================
//
// New functionality:
// - List pending internship documents
// - List all current-semester internship documents
// - Securely preview uploaded documents
// - Approve documents
// - Reject documents with a required reason
//
// These endpoints enforce coordinator/student assignment
// authorization on the backend.
// ============================================================

// ============================================================
// INTERNSHIP DOCUMENT TYPES
// ============================================================

export type InternshipDocumentStatus =
  | 'pending'
  | 'verified'
  | 'rejected'

export type InternshipDocumentDecision =
  | 'verified'
  | 'rejected'

export interface CoordinatorInternshipDocumentStudent {
  id: string
  name: string
  student_id: string | null
}

export interface CoordinatorInternshipDocument {
  id: string

  student: CoordinatorInternshipDocumentStudent

  type: string

  description: string | null

  original_filename: string | null

  verification_status: InternshipDocumentStatus

  validation_confidence: number | null

  validation_message: string | null

  academic_year: string | null

  semester: string | null

  review_notes: string | null

  reviewed_by: string | null

  reviewed_at: string | null

  created_at: string | null
}

export interface InternshipDocumentReviewResult {
  id: string

  verification_status: InternshipDocumentStatus

  review_notes: string | null

  reviewed_by: string | null

  reviewed_at: string | null

  message: string
}

export interface InternshipDocumentFile {
  url: string
  contentType: string
}

// ============================================================
// GET PENDING INTERNSHIP DOCUMENTS
// ============================================================

export function getCoordinatorPendingInternshipDocuments():
  Promise<CoordinatorInternshipDocument[]> {
  return apiRequest<CoordinatorInternshipDocument[]>(
    '/api/v1/documents/coordinator/pending',
  )
}

// ============================================================
// GET ALL CURRENT-SEMESTER INTERNSHIP DOCUMENTS
// ============================================================

export function getCoordinatorAllInternshipDocuments():
  Promise<CoordinatorInternshipDocument[]> {
  return apiRequest<CoordinatorInternshipDocument[]>(
    '/api/v1/documents/coordinator/all',
  )
}

// ============================================================
// PREVIEW INTERNSHIP DOCUMENT
// ============================================================

export async function getCoordinatorInternshipDocumentFile(
  documentId: string,
): Promise<InternshipDocumentFile> {
  const encodedDocumentId = encodeURIComponent(documentId)

  const blob = await apiRequestBlob(
    `/api/v1/documents/${encodedDocumentId}/image`,
  )

  return {
    url: URL.createObjectURL(blob),
    contentType: blob.type,
  }
}

// ============================================================
// APPROVE OR REJECT INTERNSHIP DOCUMENT
// ============================================================

export function reviewCoordinatorInternshipDocument(
  documentId: string,
  decision: InternshipDocumentDecision,
  notes: string,
): Promise<InternshipDocumentReviewResult> {
  const cleanNotes = notes.trim()

  if (decision === 'rejected' && !cleanNotes) {
    return Promise.reject(
      new Error('A rejection reason is required.'),
    )
  }

  if (cleanNotes.length > 2000) {
    return Promise.reject(
      new Error(
        'Review notes must not exceed 2000 characters.',
      ),
    )
  }

  return apiRequest<InternshipDocumentReviewResult>(
    `/api/v1/documents/${encodeURIComponent(documentId)}/review`,
    {
      method: 'PUT',

      body: JSON.stringify({
        decision,
        notes: cleanNotes || null,
      }),
    },
  )
}
