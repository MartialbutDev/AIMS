import { useEffect, useState } from 'react'
import { getCurrentUserSession, signIn } from '../services/authService'
import { roles, type UserRole, type UserSession } from '../types/auth'

const SESSION_KEY = 'aims-session'

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && roles.some((role) => role === value)
}

function readSession(): UserSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null
    const session: unknown = JSON.parse(stored)
    const accessToken =
      typeof session === 'object' && session !== null && 'accessToken' in session
        ? session.accessToken
        : undefined
    if (
      typeof session === 'object' &&
      session !== null &&
      'name' in session &&
      'email' in session &&
      'role' in session &&
      typeof session.name === 'string' &&
      typeof session.email === 'string' &&
      typeof accessToken === 'string' &&
      isUserRole(session.role)
    ) {
      return {
        name: session.name,
        email: session.email,
        role: session.role,
        accessToken,
      }
    }
    localStorage.removeItem(SESSION_KEY)
    return null
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function useAuthSession() {
  const [session, setSession] = useState<UserSession | null>(readSession)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRestoring, setIsRestoring] = useState(() => Boolean(readSession()))
  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken) return
    let isCurrent = true
    getCurrentUserSession(accessToken)
      .then((verifiedSession) => {
        if (!isCurrent) return
        localStorage.setItem(SESSION_KEY, JSON.stringify(verifiedSession))
        setSession(verifiedSession)
      })
      .catch(() => {
        if (!isCurrent) return
        localStorage.removeItem(SESSION_KEY)
        setSession(null)
      })
      .finally(() => {
        if (isCurrent) setIsRestoring(false)
      })
    return () => { isCurrent = false }
  }, [accessToken])

  async function login(role: UserRole, loginIdentifier: string, password: string) {
    setIsSigningIn(true)
    try {
      const nextSession = await signIn(role, loginIdentifier, password)
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
      setIsRestoring(true)
      setSession(nextSession)
    } finally {
      setIsSigningIn(false)
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  return { session, isSigningIn, isRestoring, login, logout }
}
