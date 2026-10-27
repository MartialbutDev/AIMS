import { isAxiosError } from 'axios';
import api from './api';

export class PasswordResetError extends Error {
  constructor(message: string, public retryAfter = 0) { super(message); }
}
function failure(error: unknown): never {
  if (isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail;
    const retry = Number(error.response?.headers?.['retry-after'] ?? 0);
    throw new PasswordResetError(typeof detail === 'string' ? detail : error.response?.status === 422
      ? 'Check your email, six-digit code, and password, then try again.'
      : 'Unable to contact AIMS. Check your connection and try again.', Number.isFinite(retry) ? retry : 0);
  }
  throw new PasswordResetError('Unable to complete this request. Please try again.');
}
export const passwordResetService = {
  async request(email: string): Promise<{ message: string; challenge_id: string; expires_in: number; resend_after: number }> {
    try { return (await api.post('/auth/password-reset/otp/request', { email: email.trim() }, { timeout: 15000 })).data; }
    catch (error) { return failure(error); }
  },
  async verify(challenge_id: string, otp: string): Promise<{ reset_token: string; expires_in: number }> {
    try { return (await api.post('/auth/password-reset/otp/verify', { challenge_id, otp })).data; }
    catch (error) { return failure(error); }
  },
  async complete(challenge_id: string, reset_token: string, new_password: string): Promise<{ message: string }> {
    try { return (await api.post('/auth/password-reset/otp/complete', { challenge_id, reset_token, new_password })).data; }
    catch (error) { return failure(error); }
  },
};
