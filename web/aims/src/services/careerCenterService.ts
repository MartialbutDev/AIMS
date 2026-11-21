
import { getDashboardAnalytics } from './analyticsService'
import { apiRequest } from './apiClient'
import type { DashboardData } from '../types/dashboard'

import type { IntakeSummary } from './companyIntakeService'

export interface CareerCompany {
  intake?: IntakeSummary
  id: string
  name: string
  description: string | null
  address: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  industry: string | null
  website: string | null
  ustp_coverage: string | null
  nature_of_partnership: string | null
  moa_notarized_at: string | null
  moa_notarized_year: number | null
  moa_effectivity_years: number | null

  is_active: boolean
  is_moa_signed: boolean

  moa_reference: string | null
  moa_signed_at: string | null
  moa_effective_at: string | null
  moa_expires_at: string | null

  created_at: string
  updated_at: string | null
}

export interface CareerCompanyPayload {
  intern_capacity?: number
  intake_version?: number
  name: string
  description?: string | null
  address?: string | null
  contact_person?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  industry?: string | null
  website?: string | null
  ustp_coverage?: string | null
  nature_of_partnership?: string | null
  moa_notarized_at?: string | null
  moa_notarized_year?: number | null
  moa_effectivity_years?: number | null

  is_active?: boolean
  is_moa_signed?: boolean

  moa_reference?: string | null
  moa_signed_at?: string | null
  moa_effective_at?: string | null
  moa_expires_at?: string | null
}

export function getCareerCenterDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}

/**
 * Returns all company records for the Career Center,
 * including inactive companies.
 */
export async function getCareerCompanies(): Promise<CareerCompany[]> {
  const pageSize = 200
  const companies: CareerCompany[] = []
  let skip = 0

  while (true) {
    const result = await apiRequest<CareerCompany[]>(
      `/api/v1/companies/manage?skip=${skip}&limit=${pageSize}`
    )

    companies.push(...result)

    if (result.length < pageSize) break

    skip += result.length
  }

  return companies
}

export function createCareerCompany(
  payload: CareerCompanyPayload
): Promise<CareerCompany> {
  return apiRequest<CareerCompany>('/api/v1/companies/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCareerCompany(
  companyId: string,
  payload: Partial<CareerCompanyPayload>
): Promise<CareerCompany> {
  return apiRequest<CareerCompany>(
    `/api/v1/companies/${encodeURIComponent(companyId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  )
}
