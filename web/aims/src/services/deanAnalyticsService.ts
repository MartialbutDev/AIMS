import { apiRequest } from './apiClient'

export interface CoordinatorAnalytics {
  coordinator_id: string
  coordinator_name: string
  student_count: number
  average_document_completion_percent: number
  average_ojt_completion_percent: number
  fully_complete_students: number
  fully_complete_percent: number
}

export interface DeanAnalytics {
  academic_year: string
  semester: string
  unassigned_students_available: boolean
  completion: { deployed: number; completed: number; grade_released: number; completed_legacy: number }
  enrolled_student_count: number
  gender_distribution: {
    male: number
    female: number
    other: number
    prefer_not_to_say: number
    not_provided: number
  }
  assigned_student_count: number
  unassigned_student_count: number | null
  average_document_completion_percent: number
  average_ojt_completion_percent: number
  fully_complete_students: number
  fully_complete_percent: number
  coordinators: CoordinatorAnalytics[]
}

export function getDeanAnalytics(): Promise<DeanAnalytics> {
  return apiRequest<DeanAnalytics>('/api/v1/analytics/dean')
}
