import { formatAccountName, roles, type UserRole, type UserSession } from '../types/auth'
import { apiRequest, ApiResponseError } from './apiClient'
import { forgetLegacySession, isSignedOut, readLegacySession } from './sessionStorage'

interface AuthUser {
  email: string
  first_name: string
  middle_name?: string | null
  last_name: string
  role: string
  avatar_url?: string | null
}

interface LoginResponse { access_token: string; user: AuthUser }

function fromResponse({ access_token, user }: LoginResponse): UserSession {
  const role = user.role === 'hte_supervisor' ? 'company' : user.role
  if (!roles.includes(role as UserRole)) throw new Error('This account cannot sign in to AIMS on the web.')
  return { role: role as UserRole, email: user.email, name: formatAccountName(user), accessToken: access_token, avatarPath: user.avatar_url }
}

export async function signIn(
  role: UserRole,
  loginIdentifier: string,
  password: string,
  keepSignedIn = false,
): Promise<UserSession> {
  const response = await apiRequest<LoginResponse>(role === 'student' ? '/api/v1/auth/login/student' : '/api/v1/auth/login/web', {
    method: 'POST', credentials: 'include', headers: { 'X-AIMS-Web-Role': role },
    body: JSON.stringify({ email: loginIdentifier, password, remember_me: keepSignedIn }),
  })
  const session = fromResponse(response)
  if (session.role !== role) throw new Error('This account does not have access to the selected workspace.')
  return session
}

export async function restoreBrowserSession(signal: AbortSignal): Promise<UserSession | null> {
  if (isSignedOut()) return null
  const path = '/api/v1/auth/browser-session'
  const options = { credentials: 'include', cache: 'no-store', signal, headers: { 'X-AIMS-Browser': '1' } } as const
  try {
    const existing = await apiRequest<LoginResponse | null>(path, options)
    if (existing) return fromResponse(existing)
    const legacy = readLegacySession()
    if (!legacy) return null
    const migrated = await apiRequest<LoginResponse>(path, {
      ...options, method: 'POST', headers: { ...options.headers, Authorization: `Bearer ${legacy.token}` },
      body: JSON.stringify({ remember_me: legacy.remember }),
    })
    return fromResponse(migrated)
  } catch (error) {
    if (!(error instanceof ApiResponseError) || error.status !== 401) throw error
    forgetLegacySession()
    return null
  }
}