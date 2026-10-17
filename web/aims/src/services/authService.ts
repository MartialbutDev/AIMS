import type { UserRole, UserSession } from '../types/auth'
import { apiRequest } from './apiClient'

export async function signIn(
  role: UserRole,
  loginIdentifier: string,
  password: string,
): Promise<UserSession> {
  const response = await apiRequest<{
    access_token: string
    token_type: string
    user: {
      email: string
      first_name: string
      last_name: string
      role: string
    }
  }>('/api/v1/auth/login/web', {
    method: 'POST',
    body: JSON.stringify({ email: loginIdentifier, password }),
  })
  const backendRole = response.user.role === 'hte_supervisor' ? 'company' : response.user.role
  if (backendRole !== role) {
    throw new Error('This account does not have access to the selected workspace.')
  }
  return {
    role,
    email: response.user.email,
    name: `${response.user.first_name} ${response.user.last_name}`.trim(),
    accessToken: response.access_token,
  }
}

export async function getCurrentUserSession(accessToken: string): Promise<UserSession> {
  const user = await apiRequest<{
    email: string
    first_name: string
    last_name: string
    role: string
  }>('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const role = user.role === 'hte_supervisor' ? 'company' : user.role
  if (!['coordinator', 'dean', 'career_center', 'company', 'admin'].includes(role)) {
    throw new Error('This account cannot sign in to the web workspace.')
  }
  return {
    email: user.email,
    name: `${user.first_name} ${user.last_name}`.trim(),
    role: role as UserRole,
    accessToken,
  }
}
