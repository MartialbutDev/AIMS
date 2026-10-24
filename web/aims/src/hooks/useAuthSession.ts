
import { useEffect, useState } from 'react'
import { getCurrentUserSession, signIn } from '../services/authService'
import { roles, type UserRole, type UserSession } from '../types/auth'

const SESSION_KEY = 'aims-session'

// ============================================================
// VALIDATE USER ROLE
// ============================================================

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    roles.some((role) => role === value)
  )
}

// ============================================================
// READ SAVED SESSION
// ============================================================

function readSession(): UserSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)

    if (!stored) {
      return null
    }

    const session: unknown = JSON.parse(stored)

    if (
      typeof session === 'object' &&
      session !== null &&
      'name' in session &&
      'email' in session &&
      'role' in session &&
      'accessToken' in session &&
      typeof session.name === 'string' &&
      typeof session.email === 'string' &&
      typeof session.accessToken === 'string' &&
      session.accessToken.trim().length > 0 &&
      isUserRole(session.role)
    ) {
      return {
        name: session.name,
        email: session.email,
        role: session.role,
        accessToken: session.accessToken,
      }
    }

    localStorage.removeItem(SESSION_KEY)
    return null
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

// ============================================================
// AUTHENTICATION SESSION HOOK
// ============================================================

export function useAuthSession() {
  useEffect(() => { const update = () => setSession(readSession()); window.addEventListener('aims-session-updated', update); return () => window.removeEventListener('aims-session-updated', update) }, [])
  const [session, setSession] = useState<UserSession | null>(
    readSession,
  )

  const [isSigningIn, setIsSigningIn] = useState(false)

  // Only restored sessions require an initial validation.
  const [tokenToRestore, setTokenToRestore] = useState<
    string | null
  >(() => readSession()?.accessToken ?? null)

  const [isRestoring, setIsRestoring] = useState(
    () => Boolean(readSession()),
  )

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

        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify(verifiedSession),
        )

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

        localStorage.removeItem(SESSION_KEY)
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
  ): Promise<void> {
    setIsSigningIn(true)

    try {
      const nextSession = await signIn(
        role,
        loginIdentifier,
        password,
      )

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(nextSession),
      )

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

  function logout() {
    localStorage.removeItem(SESSION_KEY)

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
