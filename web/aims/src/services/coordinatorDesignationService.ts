
import { apiRequest } from './apiClient'

// ============================================================
// TYPES
// ============================================================

export interface EligibleCoordinatorFaculty {
  id: string
  name: string
  email: string
}

export interface CoordinatorDesignation {
  id: string
  coordinator_id: string
  coordinator_name: string
  academic_year: string
  semester: string
  is_active: boolean
}

export interface CreateCoordinatorDesignation {
  coordinator_id: string
  academic_year: string
  semester: '1' | '2'
}

export interface DesignationResult {
  message: string
  designation: CoordinatorDesignation
  eligible_students_checked: number
  new_student_assignments: number
  already_assigned: number
  pending_assignment: number
}

export interface DeactivateDesignationResult {
  id: string
  is_active: boolean
  message: string
  note?: string
}

// ============================================================
// GET ELIGIBLE FACULTY
// ============================================================

export function getEligibleCoordinatorFaculty():
  Promise<EligibleCoordinatorFaculty[]> {
  return apiRequest<EligibleCoordinatorFaculty[]>(
    '/api/v1/admin/coordinators/faculty'
  )
}

// ============================================================
// GET DESIGNATIONS
// ============================================================

export function getCoordinatorDesignations():
  Promise<CoordinatorDesignation[]> {
  return apiRequest<CoordinatorDesignation[]>(
    '/api/v1/admin/coordinators'
  )
}

// ============================================================
// CREATE OR REACTIVATE DESIGNATION
// ============================================================

export function createCoordinatorDesignation(
  payload: CreateCoordinatorDesignation
): Promise<DesignationResult> {
  return apiRequest<DesignationResult>(
    '/api/v1/admin/coordinators',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

// ============================================================
// DEACTIVATE DESIGNATION
// ============================================================

export function deactivateCoordinatorDesignation(
  designationId: string
): Promise<DeactivateDesignationResult> {
  return apiRequest<DeactivateDesignationResult>(
    `/api/v1/admin/coordinators/${encodeURIComponent(
      designationId
    )}/deactivate`,
    {
      method: 'PATCH',
    }
  )
}
