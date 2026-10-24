import { apiRequest } from './apiClient'
export interface AccountProfile { first_name: string; middle_name: string | null; last_name: string; phone: string | null; email: string; is_verified: boolean }
export const getAccount = () => apiRequest<AccountProfile>('/api/v1/auth/me')
export const saveAccount = (profile: Pick<AccountProfile, 'first_name' | 'middle_name' | 'last_name' | 'phone'>) => apiRequest<AccountProfile>('/api/v1/auth/me', { method: 'PUT', body: JSON.stringify(profile) })
export const changeAccountPassword = (current_password: string, new_password: string) => apiRequest<{message:string}>('/api/v1/auth/change-password', { method:'POST', body:JSON.stringify({current_password,new_password}) })
export const requestVerification = () => apiRequest<{message:string}>('/api/v1/auth/request-email-verification', {method:'POST'})
