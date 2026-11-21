import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../services/apiClient'
import { restoreBrowserSession, signIn } from '../services/authService'
import type { UserRole, UserSession } from '../types/auth'
import {
  SESSION_EVENT_KEY, forgetLegacySession, isSignedOut, readLegacySession, readStoredSession,
  sessionEvent, setCurrentSession, shareSessionChange,
} from '../services/sessionStorage'

export function useAuthSession() {
  const [session, setSession] = useState<UserSession | null>(readStoredSession)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [restoreError, setRestoreError] = useState(false)
  const pending = useRef<AbortController | null>(null)

  const restore = useCallback(async () => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const marker = sessionEvent()
    setRestoreError(false)
    setIsRestoring(true)
    try {
      const restored = await restoreBrowserSession(controller.signal)
      if (controller.signal.aborted || marker !== sessionEvent()) return
      // Announce a legacy migration so older tabs drop stale account information.
      if (restored && readLegacySession()) shareSessionChange(restored)
      else {
        forgetLegacySession()
        setCurrentSession(restored)
      }
    } catch {
      if (!controller.signal.aborted) setRestoreError(true)
    } finally {
      if (pending.current === controller && !controller.signal.aborted) setIsRestoring(false)
    }
  }, [])

  useEffect(() => {
    const update = () => setSession(readStoredSession())
    const sync = (event: StorageEvent) => {
      if (event.key !== SESSION_EVENT_KEY && event.key !== null) return
      pending.current?.abort()
      setCurrentSession(null)
      setRestoreError(false)
      if (isSignedOut()) setIsRestoring(false)
      else void restore()
    }
    const pageShow = (event: PageTransitionEvent) => { if (event.persisted) void restore() }
    window.addEventListener('aims-session-updated', update)
    window.addEventListener('storage', sync)
    window.addEventListener('pageshow', pageShow)
    void restore()
    return () => {
      pending.current?.abort()
      window.removeEventListener('aims-session-updated', update)
      window.removeEventListener('storage', sync)
      window.removeEventListener('pageshow', pageShow)
    }
  }, [restore])

  async function login(role: UserRole, identifier: string, password: string, remember = false) {
    setIsSigningIn(true)
    try {
      const next = await signIn(role, identifier, password, remember)
      pending.current?.abort()
      shareSessionChange(next)
      setRestoreError(false)
      setIsRestoring(false)
    } finally { setIsSigningIn(false) }
  }

  async function logout() {
    const token = readStoredSession()?.accessToken
    pending.current?.abort()
    shareSessionChange(null)
    setRestoreError(false)
    setIsRestoring(false)
    if (!token) return
    try {
      await apiRequest('/api/v1/auth/logout', {
        method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      })
    } catch { /* Sign-out in this browser also works offline. */ }
  }

  return { session, isSigningIn, isRestoring, restoreError, retryRestore: restore, login, logout }
}