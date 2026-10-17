import { getDashboardAnalytics } from './analyticsService'
import { apiRequest, apiRequestBlob } from './apiClient'
import type { DashboardData } from '../types/dashboard'

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
  student: Pick<CoordinatorStudent, 'id' | 'student_id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'is_active'>
  journey: CoordinatorJourney
  document_statuses: Array<{ type: string; status: string }>
  documents: Array<{ id: string; type: string; filename: string | null; status: string; created_at: string }>
  applications: Array<{ id: string; position: string; company: string | null; status: string; applied_date: string }>
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
  journals: Array<{ id: string; week: number; title: string; status: string; summary: string | null }>
  evaluation: { grade: number; notes: string | null; updated_at: string } | null
}

interface StudentPage {
  items: CoordinatorStudent[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export function getCoordinatorDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}

export function getCoordinatorStudents(page: number, search: string): Promise<StudentPage> {
  const params = new URLSearchParams({ page: String(page), limit: '100' })
  if (search.trim()) params.set('search', search.trim())
  return apiRequest<StudentPage>(`/api/v1/coordinator/students?${params}`)
}

export function getCoordinatorStudentDetail(studentId: string): Promise<CoordinatorStudentDetail> {
  return apiRequest<CoordinatorStudentDetail>(`/api/v1/coordinator/students/${encodeURIComponent(studentId)}`)
}

export function saveCoordinatorEvaluation(
  studentId: string,
  grade: number,
  notes: string,
): Promise<{ grade: number; notes: string | null; updated_at: string }> {
  return apiRequest(`/api/v1/coordinator/students/${encodeURIComponent(studentId)}/evaluation`, {
    method: 'PUT',
    body: JSON.stringify({ grade, notes: notes || null }),
  })
}

export async function getCoordinatorStudentFile(
  studentId: string,
  filePath: string,
): Promise<{ url: string; contentType: string }> {
  const blob = await apiRequestBlob(
    `/api/v1/coordinator/students/${encodeURIComponent(studentId)}/${filePath}`,
  )
  return { url: URL.createObjectURL(blob), contentType: blob.type }
}
