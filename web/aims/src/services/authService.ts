import { formatAccountName, type UserRole, type UserSession } from '../types/auth'
import { apiRequest } from './apiClient'

interface AuthUser {
  email: string
  first_name: string
  middle_name?: string | null
  last_name: string
  role: string
  avatar_url?: string | null
}

export async function signIn(
  role: UserRole,
  loginIdentifier: string,
  password: string,
  keepSignedIn = false,
): Promise<UserSession> {
  const response = await apiRequest<{
    access_token: string
    token_type: string
    user: AuthUser
  }>(role === 'student' ? '/api/v1/auth/login/student' : '/api/v1/auth/login/web', {
    method: 'POST',
    body: JSON.stringify({ email: loginIdentifier, password, remember_me: keepSignedIn }),
  })
  const backendRole = response.user.role === 'hte_supervisor' ? 'company' : response.user.role
  if (backendRole !== role) {
    throw new Error('This account does not have access to the selected workspace.')
  }
  return {
    role,
    email: response.user.email,
    name: formatAccountName(response.user),
    accessToken: response.access_token,
    avatarPath: response.user.avatar_url,
  }
}

export async function getCurrentUserSession(accessToken: string): Promise<UserSession> {
  const user = await apiRequest<AuthUser>('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const role = user.role === 'hte_supervisor' ? 'company' : user.role
  if (!['student', 'coordinator', 'dean', 'career_center', 'company', 'admin'].includes(role)) {
    throw new Error('This account cannot sign in to the web workspace.')
  }
  return {
    email: user.email,
    name: formatAccountName(user),
    role: role as UserRole,
    accessToken,
    avatarPath: user.avatar_url,
  }
}
