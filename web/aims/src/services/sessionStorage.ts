import { roles, type UserSession } from '../types/auth'

const LEGACY_KEY = 'aims-session'
export const SESSION_EVENT_KEY = 'aims-browser-session-event'
const signedOut = 'signed-out'
const expired = 'expired'
let current: UserSession | null = null

export function readStoredSession() { return current }

export function setCurrentSession(session: UserSession | null) {
  current = session
  window.dispatchEvent(new Event('aims-session-updated'))
}

function browserStorage(name: 'localStorage' | 'sessionStorage'): Storage | null {
  try { return window[name] } catch { return null }
}

export function sessionEvent() {
  try { return browserStorage('localStorage')?.getItem(SESSION_EVENT_KEY) ?? null }
  catch { return null }
}

export function isSignedOut() {
  const marker = sessionEvent()
  return marker === signedOut || marker === expired
}

export function isSessionExpired() { return sessionEvent() === expired }

const storageNames = ['sessionStorage', 'localStorage'] as const

export function forgetLegacySession() {
  for (const name of storageNames) {
    try { browserStorage(name)?.removeItem(LEGACY_KEY) }
    catch { /* Session cookies still work when browser storage is unavailable. */ }
  }
}

export function shareSessionChange(session: UserSession | null, sessionExpired = false) {
  forgetLegacySession()
  // This marker carries no credentials or account information.
  const marker = session
    ? Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')
    : sessionExpired ? expired : signedOut
  try { browserStorage('localStorage')?.setItem(SESSION_EVENT_KEY, marker) }
  catch { /* Cross-tab storage events are optional. */ }
  setCurrentSession(session)
}

export function readLegacySession(): { token: string; remember: boolean } | null {
  if (sessionEvent() !== null) return null
  for (const name of storageNames) {
    try {
      const value = JSON.parse(browserStorage(name)?.getItem(LEGACY_KEY) ?? 'null')
      if (value && roles.includes(value.role) && typeof value.accessToken === 'string' && value.accessToken) {
        return { token: value.accessToken, remember: name === 'localStorage' && value.rememberMe === true }
      }
    } catch { /* Ignore unavailable storage and invalid older records. */ }
  }
  return null
}

export function updateCurrentSession(
  accessToken: string,
  details: Partial<Pick<UserSession, 'name' | 'avatarPath'>>,
) {
  if (current?.accessToken === accessToken) setCurrentSession({ ...current, ...details })
}