import { getDashboardAnalytics } from './analyticsService'
import type { DashboardData } from '../types/dashboard'

export function getCompanyDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}
