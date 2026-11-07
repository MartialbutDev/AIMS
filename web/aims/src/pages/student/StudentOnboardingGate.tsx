import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserSession } from '../../types/auth'
import { studentApi } from '../../services/studentService'
import { isApprovedStudentOnboarding, onboardingAccessibleSections } from '../../services/studentOnboardingAccess'

/** Keep account/help controls reachable; verify every internship route before rendering it. */
export function StudentOnboardingGate({ session, onLogout, children }: { session: UserSession; onLogout: () => void; children: (approved: boolean) => ReactNode }) {
  const { pathname } = useLocation()
  const section = pathname.split('/')[2] || 'dashboard'
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; approved: boolean; error?: string } | null>(null)
  const key = `${session.accessToken}|${pathname}`

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    void studentApi<unknown>('/onboarding/me', { signal }).then(status => {
      if (!controller.signal.aborted) setResult({ key, approved: isApprovedStudentOnboarding(status) })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, approved: false, error: 'We could not confirm your orientation and COR status. Please retry before continuing.' })
    })
    return () => controller.abort()
  }, [key, revision])

  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') setRevision(v => v + 1) }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('aims-workflow-changed', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('aims-workflow-changed', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  if (result?.key !== key) return <main className="dashboard-loading"><span className="loading-spinner" /><p>Checking your orientation and COR approval…</p></main>
  if (result.error) return <main className="dashboard-error"><div><h1>Onboarding status unavailable</h1><p role="alert">{result.error}</p><button className="primary-button" onClick={() => setRevision(v => v + 1)}>Retry onboarding check</button><button className="text-button" onClick={onLogout}>Sign out</button></div></main>
  if (!result.approved && !onboardingAccessibleSections.has(section)) return <Navigate to="/student/onboarding" replace />
  return children(result.approved)
}
