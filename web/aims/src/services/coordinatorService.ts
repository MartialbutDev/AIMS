import { getDashboardAnalytics } from './analyticsService'
import type { DashboardData } from '../types/dashboard'

export function getCoordinatorDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}
