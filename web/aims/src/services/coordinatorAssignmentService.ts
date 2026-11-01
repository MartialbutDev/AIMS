import { apiRequest } from './apiClient'

export interface AssignedStudent {
  id: string
  student_id: string | null
  name: string
}

export interface CoordinatorAssignmentGroup {
  id: string
  name: string
  can_assign: boolean
  students: AssignedStudent[]
}

export interface CoordinatorAssignments {
  academic_year: string
  semester: '1' | '2'
  coordinators: CoordinatorAssignmentGroup[]
  unassigned_students: AssignedStudent[]
}

export function getCoordinatorAssignments(): Promise<CoordinatorAssignments> {
  return apiRequest<CoordinatorAssignments>('/api/v1/users/coordinator-assignments')
}

export function assignStudentToCoordinator(
  coordinatorId: string,
  studentId: string,
  academicYear: string,
  semester: '1' | '2',
): Promise<{ coordinator_id: string; student_id: string }> {
  return apiRequest('/api/v1/users/coordinator-assignments', {
    method: 'POST',
    body: JSON.stringify({ coordinator_id: coordinatorId, student_id: studentId, academic_year: academicYear, semester }),
  })
}

export function removeStudentCoordinatorAssignment(
  coordinatorId: string,
  studentId: string,
  academicYear: string,
  semester: '1' | '2',
): Promise<{ message: string }> {
  return apiRequest(
    `/api/v1/users/coordinator-assignments/${encodeURIComponent(coordinatorId)}/${encodeURIComponent(studentId)}?academic_year=${encodeURIComponent(academicYear)}&semester=${semester}`,
    { method: 'DELETE' },
  )
}
