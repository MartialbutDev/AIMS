import { roles, type UserSession } from '../types/auth'

export const SESSION_KEY = 'aims-session'

function parseSession(raw: string | null): UserSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value.name !== 'string' || typeof value.email !== 'string' || !roles.includes(value.role) || typeof value.accessToken !== 'string' || !value.accessToken.trim()) return null
    // This only clears expired local state. The server still validates the JWT.
    const payload = value.accessToken.split('.')[1]
    if (payload) {
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) return null
    }
    return { name: value.name, email: value.email, role: value.role, accessToken: value.accessToken }
  } catch { return null }
}

export function readStoredSession(): UserSession | null {
  try {
    const transient = sessionStorage.getItem(SESSION_KEY)
    const session = parseSession(transient)
    if (session) return session
    if (transient) sessionStorage.removeItem(SESSION_KEY)
    const raw = localStorage.getItem(SESSION_KEY)
    const saved = parseSession(raw)
    if (!saved) { localStorage.removeItem(SESSION_KEY); return null }
    if (JSON.parse(raw!).rememberMe !== true) {
      // Old logins had no explicit opt-in. Keep this tab signed in, not the device.
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved))
      localStorage.removeItem(SESSION_KEY)
    }
    return saved
  } catch { return null }
}

export function saveStoredSession(session: UserSession, rememberMe?: boolean) {
  let persistent = rememberMe ?? false
  if (rememberMe === undefined) {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
      persistent = saved?.rememberMe === true && saved.accessToken === session.accessToken
    } catch { persistent = false }
  }
  const destination = persistent ? localStorage : sessionStorage
  const other = persistent ? sessionStorage : localStorage
  // Never fall back to persistent storage if session storage is unavailable.
  destination.setItem(SESSION_KEY, JSON.stringify({ ...session, rememberMe: persistent }))
  other.removeItem(SESSION_KEY)
}

export function clearStoredSession() {
  for (const name of ['sessionStorage', 'localStorage'] as const) {
    try { window[name].removeItem(SESSION_KEY) } catch { /* Continue clearing the other store. */ }
  }
}
