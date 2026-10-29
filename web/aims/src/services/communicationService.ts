import { apiRequest } from './apiClient'
export interface DeliveryStatus { email_enabled: boolean; email_configured: boolean; email_delivery_enabled: boolean; email_verified: boolean; push_delivery_enabled: boolean; registered_devices: number; push_failed: number; scheduler_enabled: boolean; email: { queued: number; smtp_accepted: number; failed: number } }
export const communications = {
  delivery: () => apiRequest<DeliveryStatus>('/api/v1/notification-delivery'),
  email: (email_enabled: boolean) => apiRequest('/api/v1/notification-delivery/preferences', { method: 'PUT', body: JSON.stringify({ email_enabled }) }),
}
export function notificationDestination(data: Record<string, unknown> | null | undefined, kind: string, root: string): string | null {
  const allowed: Record<string, string[]> = {
    coordinator: ['notifications', 'applications', 'students', 'document-verification', 'document-templates', 'direct-placements'],
    dean: ['notifications', 'direct-placements'], 'career-center': ['notifications', 'applications', 'companies', 'direct-placements'],
    company: ['notifications', 'applications', 'interns'], admin: ['notifications', 'document-verification', 'assignments', 'coordinators'],
  }
  const path = data?.web_path
  if (typeof path === 'string' && (allowed[root] ?? []).some(page => path === `/${root}/${page}`)) return path
  if (kind === 'application' && ['coordinator', 'company', 'career-center'].includes(root)) return `/${root}/applications`
  return null
}
