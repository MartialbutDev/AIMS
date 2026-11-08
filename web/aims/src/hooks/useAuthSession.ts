
import { useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient'
import { getCurrentUserSession, signIn } from '../services/authService'
import type { UserRole, UserSession } from '../types/auth'
import { SESSION_KEY, readStoredSession, saveStoredSession, clearStoredSession } from '../services/sessionStorage'

// ============================================================
// AUTHENTICATION SESSION HOOK
// ============================================================

export function useAuthSession() {
  const [session, setSession] = useState<UserSession | null>(
    readStoredSession,
  )

  const [isSigningIn, setIsSigningIn] = useState(false)

  // Only restored sessions require an initial validation.
  const [tokenToRestore, setTokenToRestore] = useState<
    string | null
  >(() => readStoredSession()?.accessToken ?? null)

  const [isRestoring, setIsRestoring] = useState(
    () => Boolean(readStoredSession()),
  )

  useEffect(() => { const update = () => setSession(readStoredSession()); const sync = (event: StorageEvent) => { if (event.key === SESSION_KEY || event.key === null) update() }; window.addEventListener('aims-session-updated', update); window.addEventListener('storage', sync); return () => { window.removeEventListener('aims-session-updated', update); window.removeEventListener('storage', sync) } }, [])

  // ==========================================================
  // RESTORE AND VALIDATE EXISTING SESSION
  // ==========================================================

  useEffect(() => {
    if (!tokenToRestore) {
      return
    }

    let isCurrent = true

    getCurrentUserSession(tokenToRestore)
      .then((verifiedSession) => {
        if (!isCurrent) {
          return
        }

        saveStoredSession(verifiedSession)

        setSession(verifiedSession)
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return
        }

        console.warn(
          'AIMS session restoration failed:',
          error,
        )

        clearStoredSession()
        setSession(null)
      })
      .finally(() => {
        if (!isCurrent) {
          return
        }

        setIsRestoring(false)
        setTokenToRestore(null)
      })

    return () => {
      isCurrent = false
    }
  }, [tokenToRestore])

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function login(
    role: UserRole,
    loginIdentifier: string,
    password: string,
    keepSignedIn = false,
  ): Promise<void> {
    setIsSigningIn(true)

    try {
      const nextSession = await signIn(
        role,
        loginIdentifier,
        password,
        keepSignedIn,
      )

      saveStoredSession(nextSession, keepSignedIn)

      // The login endpoint has just issued this token.
      // Do not immediately repeat session restoration.
      setTokenToRestore(null)
      setIsRestoring(false)
      setSession(nextSession)
    } finally {
      setIsSigningIn(false)
    }
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function logout() {
    try { await apiRequest('/api/v1/auth/logout', { method: 'POST', signal: AbortSignal.timeout(10000) }) } catch { /* Local sign-out remains available offline. */ }
    clearStoredSession()

    setTokenToRestore(null)
    setIsRestoring(false)
    setSession(null)
  }

  // ==========================================================
  // EXPOSE AUTHENTICATION STATE
  // ==========================================================

  return {
    session,
    isSigningIn,
    isRestoring,
    login,
    logout,
  }
}
