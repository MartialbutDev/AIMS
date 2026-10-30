import { apiRequest } from './apiClient'

export interface AcademicTerm { academic_year: string; semester: string }
export type AttentionCategory = 'missing_requirements' | 'returned_completion' | 'company_confirmation' | 'coordinator_approval' | 'pending_reviews' | 'record_conflict'
export interface Workload {
  coordinator_id: string; coordinator_name: string; assigned_students: number; active_interns: number
  document_reviews: number; dtr_reviews: number; journal_reviews: number; completion_reviews: number; total_reviews: number
}
export interface DeanAnalytics extends AcademicTerm {
  generated_at: string
  overview: Record<'students_in_oversight' | 'awaiting_deployment' | 'active_interns' | 'pending_completion' | 'approved_completion' | 'grades_released', number>
  stages: { key: string; label: string; count: number }[]
  workloads: Workload[]
  attention: { key: AttentionCategory; label: string; student_count: number }[]
}
export interface AttentionDetails extends AcademicTerm {
  total: number; page: number; limit: number
  items: { student_id: string; student_number: string | null; student_name: string; coordinator_name: string; company_name: string | null; stage: string; details: string[]; review_items: number }[]
}
export const termLabel = (term: AcademicTerm) => `AY ${term.academic_year} · Semester ${term.semester}`
export function getDeanTerms(signal?: AbortSignal) {
  return apiRequest<{ current: AcademicTerm; items: AcademicTerm[] }>('/api/v1/analytics/dean/terms', { signal })
}
export function getDeanAnalytics(term: AcademicTerm, signal?: AbortSignal) {
  return apiRequest<DeanAnalytics>(`/api/v1/analytics/dean?${new URLSearchParams({ ...term })}`, { signal })
}
export function getDeanAttention(term: AcademicTerm, category: AttentionCategory, page: number, coordinator: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ ...term, category, page: String(page), limit: '20' })
  if (coordinator) params.set('coordinator_id', coordinator)
  return apiRequest<AttentionDetails>(`/api/v1/analytics/dean/attention?${params}`, { signal })
}
