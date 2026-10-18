import { apiRequest } from './apiClient'

export interface AssignedStudent {
  id: string
  student_id: string | null
  name: string
}

export interface CoordinatorAssignmentGroup {
  id: string
  name: string
  students: AssignedStudent[]
}

export interface CoordinatorAssignments {
  coordinators: CoordinatorAssignmentGroup[]
  unassigned_students: AssignedStudent[]
}

export function getCoordinatorAssignments(): Promise<CoordinatorAssignments> {
  return apiRequest<CoordinatorAssignments>('/api/v1/users/coordinator-assignments')
}

export function assignStudentToCoordinator(
  coordinatorId: string,
  studentId: string,
): Promise<{ coordinator_id: string; student_id: string }> {
  return apiRequest('/api/v1/users/coordinator-assignments', {
    method: 'POST',
    body: JSON.stringify({ coordinator_id: coordinatorId, student_id: studentId }),
  })
}

export function removeStudentCoordinatorAssignment(
  coordinatorId: string,
  studentId: string,
): Promise<{ message: string }> {
  return apiRequest(
    `/api/v1/users/coordinator-assignments/${encodeURIComponent(coordinatorId)}/${encodeURIComponent(studentId)}`,
    { method: 'DELETE' },
  )
}
