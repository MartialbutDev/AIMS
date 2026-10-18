
import { getDashboardAnalytics } from './analyticsService'
import { apiRequest } from './apiClient'
import type { DashboardData } from '../types/dashboard'

// ========================================
// COMPANY DATA TYPES
// ========================================

export interface CareerCompany {
  id: string
  name: string
  contact_email?: string | null
  is_moa_signed: boolean
  is_active: boolean
}

// ========================================
// CAREER CENTER DASHBOARD
// ========================================

export function getCareerCenterDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}

// ========================================
// COMPANY DIRECTORY
// ========================================

export function getCareerCompanies(): Promise<CareerCompany[]> {
  return apiRequest<CareerCompany[]>('/api/v1/companies/')
}
