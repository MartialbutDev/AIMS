import { getDashboardAnalytics } from './analyticsService'
import type { DashboardData } from '../types/dashboard'

export function getCareerCenterDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}
