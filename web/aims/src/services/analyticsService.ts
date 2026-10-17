import { apiRequest } from './apiClient'
import type { DashboardData } from '../types/dashboard'

export function getDashboardAnalytics(): Promise<DashboardData> {
  return apiRequest<DashboardData>('/api/v1/analytics/dashboard')
}
