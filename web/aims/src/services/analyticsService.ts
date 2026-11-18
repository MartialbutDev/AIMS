import { apiRequest } from './apiClient'
import type { DashboardData, DashboardMetric } from '../types/dashboard'

export function getDashboardAnalytics(): Promise<DashboardData> {
  return apiRequest<DashboardData>('/api/v1/analytics/dashboard')
}

export function internshipMetrics(data: DashboardData): DashboardMetric[] {
  const counts = data.completion
  if (!data.academic_year || !data.semester || !counts) return []

  const metrics: DashboardMetric[] = [
    { label: 'Active internships', value: counts.deployed.toLocaleString(), change: 'Current term', icon: 'briefcase', tone: 'blue' },
    { label: 'Coordinator-approved completions', value: counts.completed.toLocaleString(), change: 'Current term', icon: 'chart', tone: 'green' },
  ]
  if (counts.completed_legacy > 0) {
    metrics.push({ label: 'Historical completed records', value: counts.completed_legacy.toLocaleString(), change: 'Current term', icon: 'file', tone: 'violet' })
  }
  return metrics
}
