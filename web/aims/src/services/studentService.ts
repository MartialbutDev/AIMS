import type { AttendanceReviewFields } from '../components/AttendanceEvidence'
import { apiRequest, apiRequestBlob } from './apiClient'

export const studentApi = <T>(path: string, options?: RequestInit) => apiRequest<T>(`/api/v1${path}`, options)
export const studentWrite = <T>(path: string, body?: FormData | Record<string, unknown>, method = 'POST') => studentApi<T>(path, { method, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) })
export const filePath = (id: string) => encodeURIComponent(id)
export async function saveStudentFile(path: string, filename: string) {
  const blob = await apiRequestBlob(`/api/v1${path}`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export interface Page<T> { items: T[]; total: number; page: number; limit: number; total_pages?: number }
export interface StudentFeedback { status_label: string; reason: string; next_action: string; notice: string }
export interface StudentDocument {
  student_feedback?: StudentFeedback
  id: string; type: string; description?: string; original_filename?: string; verification_status: string
  academic_year?: string; semester?: string; created_at?: string; review_notes?: string
  version_status?: string; version_label?: string; is_current_approved?: boolean; current_approved_id?: string
}
export interface Company { id: string; name: string; industry?: string; description?: string; address?: string; contact_email?: string; contact_phone?: string; is_active: boolean; is_moa_signed: boolean; moa_effective_at?: string; moa_expires_at?: string }
export interface Application { id: string; company_id: string; company_name?: string; position: string; status: string; applied_date: string; academic_year: string; semester: string; feedback?: string; cover_letter?: string }
export interface Journey { stage: string; application_status: string; academic_year: string; semester: string; is_current_term: boolean; endorsement: { ready: boolean; status: string; review_notes?: string }; deployment_status?: string }
export interface OnboardingSubmission { id: string; document_kind?: string; original_filename: string; review_status: string; review_notes?: string; student_feedback?: StudentFeedback }
export interface Onboarding { eligible: boolean; onboarding_approved?: boolean; development_onboarding_bypass?: boolean; next_step: string; orientation: OnboardingSubmission | null; cor: OnboardingSubmission | null; coordinator_assignment: { status: string; coordinator_name?: string } }
export interface Eligibility { allowed: boolean; reason: string | null; academic_year: string; semester: string }
export interface ChecklistItem { document_type: string; label: string; required: boolean; document_id?: string; status: string }
export interface Deployment { id: string; application_id: string; company_id: string; company_name?: string; academic_year: string; semester: string; status: string; confirmed_at?: string; deployment_date?: string; checklist?: { items: ChecklistItem[]; ready_for_deployment: boolean } }
export interface Dtr extends AttendanceReviewFields { id: string; date: string; time_in: string; time_out: string | null; status: string; total_hours?: number; hours?: number; hours_rendered?: number; tasks_completed?: string; notes?: string; feedback?: string; latitude?: number | null; longitude?: number | null; location_address?: string | null }
export interface DtrSummary { total_entries: number; pending: number; submitted: number; approved: number; rejected: number; total_hours: number; required_hours: number | null; remaining_hours: number | null; progress_percent: number | null; current_company?: string; program_notice?: string | null }
export interface Journal { id: string; week: number; title: string; summary?: string; status: string; feedback?: string; submitted_date?: string }
export interface ReportSummary { academic_year: string; semester: string; applications: number; documents: number; dtr_count: number; journals: number; total_hours: number; status_distribution: Record<string, number> }
export interface Activity { id: string; title: string; description: string; status: string; created_at: string }
export interface Weekly { week: string; dtr: number; journals: number; applications: number }
export interface Placement { id: string; company_name: string; position: string; reason: string; status: string; academic_year: string; semester: string; student_decision?: string; partnership_status?: string; partnership_notes?: string; history?: { id?: string; action: string; actor_name?: string; reason?: string; details?: { reason?: string; notes?: string }; created_at: string }[] }
export interface Correction { id: string; dtr_id: string; status: string; reason: string; proposed_time_in?: string; proposed_time_out?: string; proposed?: { time_in: string; time_out: string }; company_reason?: string; coordinator_reason?: string; history?: { action: string; reason?: string }[] }
