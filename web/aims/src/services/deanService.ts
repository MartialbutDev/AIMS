import { getDashboardAnalytics } from './analyticsService'
import type { DashboardData } from '../types/dashboard'

export function getDeanDashboard(): Promise<DashboardData> {
  return getDashboardAnalytics()
}
