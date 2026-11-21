import { roles, type UserSession } from '../types/auth'

const LEGACY_KEY = 'aims-session'
export const SESSION_EVENT_KEY = 'aims-browser-session-event'
const signedOut = 'signed-out'
let current: UserSession | null = null

export function readStoredSession() { return current }

export function setCurrentSession(session: UserSession | null) {
  current = session
  window.dispatchEvent(new Event('aims-session-updated'))
}

export function sessionEvent() {
  return localStorage.getItem(SESSION_EVENT_KEY)
}

export function isSignedOut() { return sessionEvent() === signedOut }

export function forgetLegacySession() {
  sessionStorage.removeItem(LEGACY_KEY)
  localStorage.removeItem(LEGACY_KEY)
}

export function shareSessionChange(session: UserSession | null) {
  forgetLegacySession()
  // This marker carries no credentials or account information.
  localStorage.setItem(SESSION_EVENT_KEY, session ? Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-") : signedOut)
  setCurrentSession(session)
}

export function readLegacySession(): { token: string; remember: boolean } | null {
  if (sessionEvent() !== null) return null
  for (const store of [sessionStorage, localStorage]) {
    try {
      const value = JSON.parse(store.getItem(LEGACY_KEY) ?? 'null')
      if (value && roles.includes(value.role) && typeof value.accessToken === 'string' && value.accessToken) {
        return { token: value.accessToken, remember: store === localStorage && value.rememberMe === true }
      }
    } catch { /* Ignore invalid records from older versions. */ }
  }
  return null
}

export function updateCurrentSession(
  accessToken: string,
  details: Partial<Pick<UserSession, 'name' | 'avatarPath'>>,
) {
  if (current?.accessToken === accessToken) setCurrentSession({ ...current, ...details })
}