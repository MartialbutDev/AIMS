import { apiRequest } from './apiClient'
export interface DeliveryStatus { email_enabled: boolean; email_configured: boolean; email_delivery_enabled: boolean; email_verified: boolean; push_delivery_enabled: boolean; registered_devices: number; push_failed: number; scheduler_enabled: boolean; email: { queued: number; smtp_accepted: number; failed: number } }
export const communications = {
  delivery: () => apiRequest<DeliveryStatus>('/api/v1/notification-delivery'),
  email: (email_enabled: boolean) => apiRequest('/api/v1/notification-delivery/preferences', { method: 'PUT', body: JSON.stringify({ email_enabled }) }),
}
export { notificationDestination } from './notificationRouting'
