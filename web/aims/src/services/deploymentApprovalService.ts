import { apiRequest } from './apiClient'

export interface DeploymentApprovalRecord {
  id: string
  application_id: string
  academic_year: string
  semester: string
  status: 'pre_deployment' | 'deployed' | 'completed' | 'cancelled'
  deployment_date: string | null
  confirmed_at: string | null
  approval: {
    ready: boolean
    source: 'regular_application' | 'direct_placement'
    company_name: string
    position: string | null
    confirmed_by_name: string | null
    minimum_date: string | null
    maximum_date: string
    blockers: string[]
    checks: { code: string; label: string; passed: boolean }[]
    checklist: { ready_for_deployment: boolean; items: { document_type: string; label: string; status: string }[] }
  }
}
export interface StudentDeploymentApproval {
  academic_year: string
  semester: string
  accepted_application_count: number
  items: DeploymentApprovalRecord[]
}
export const deploymentApprovalService = {
  get: (studentId: string, signal?: AbortSignal) => apiRequest<StudentDeploymentApproval>(
    `/api/v1/deployments/student/${encodeURIComponent(studentId)}/approval`, { signal }),
  confirm: (id: string, deploymentDate: string) => apiRequest<{ deployment: { status: string } }>(
    `/api/v1/deployments/${encodeURIComponent(id)}/confirm`, {
      method: 'POST', body: JSON.stringify({ deployment_date: deploymentDate }),
    }),
}
