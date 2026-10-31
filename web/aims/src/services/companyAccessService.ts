import { apiRequest } from './apiClient'

export interface CompanyAccessCompany { id: string; name: string; is_active: boolean; moa_ready: boolean }
export interface CompanySupervisor { id: string; name: string; email: string }
export interface CompanyAccessLink {
  id: string; is_active: boolean; created_at: string | null
  supervisor: CompanySupervisor & { is_active: boolean; is_company_supervisor: boolean }
  company: CompanyAccessCompany
}
export interface CompanyAccessOptions {
  supervisors: CompanySupervisor[]; companies: CompanyAccessCompany[]
  supervisor_total: number; company_total: number; limit: number
}
export interface CompanyAccessPageData {
  items: CompanyAccessLink[]; total: number; page: number; limit: number; total_pages: number
  stats: { active: number; inactive: number; supervisors: number }
}
interface AccessResult { action: 'created' | 'reactivated' | 'removed' | 'unchanged'; link: CompanyAccessLink }
const base = '/api/v1/admin/company-access'
export const companyAccessService = {
  list(search: string, status: string, page: number, signal?: AbortSignal) {
    return apiRequest<CompanyAccessPageData>(`${base}?${new URLSearchParams({ search, status, page: String(page), limit: '20' })}`, { signal })
  },
  options(supervisorSearch: string, companySearch: string, signal?: AbortSignal) {
    return apiRequest<CompanyAccessOptions>(`${base}/options?${new URLSearchParams({ supervisor_search: supervisorSearch, company_search: companySearch })}`, { signal })
  },
  grant(supervisorId: string, companyId: string) {
    return apiRequest<AccessResult>(base, { method: 'POST', body: JSON.stringify({ supervisor_id: supervisorId, company_id: companyId }) })
  },
  remove(linkId: string) { return apiRequest<AccessResult>(`${base}/${encodeURIComponent(linkId)}`, { method: 'DELETE' }) },
}
