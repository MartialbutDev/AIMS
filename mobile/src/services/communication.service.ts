import api from './api';
export interface DeliveryStatus { email_enabled: boolean; email_configured: boolean; email_delivery_enabled: boolean; email_verified: boolean; push_delivery_enabled: boolean; registered_devices: number; push_failed: number; email: { queued: number; smtp_accepted: number; failed: number } }
export const communicationService = {
  delivery: async (): Promise<DeliveryStatus> => (await api.get('/notification-delivery')).data,
  email: async (email_enabled: boolean) => (await api.put('/notification-delivery/preferences', { email_enabled })).data,
};
