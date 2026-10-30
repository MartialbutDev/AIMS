import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DashboardLayout } from '../components/DashboardLayout'
import { getAdminDashboard } from '../services/adminService'
import { getCareerCenterDashboard } from '../services/careerCenterService'
import { getCompanyDashboard } from '../services/companyService'
import { getCoordinatorDashboard } from '../services/coordinatorService'
import { getDeanDashboard } from '../services/deanService'
import type { UserRole, UserSession } from '../types/auth'
import type { DashboardData } from '../types/dashboard'

interface RoleDashboardPageProps {
  session: UserSession
  onLogout: () => void
}

const dashboardLoaders = {
  coordinator: getCoordinatorDashboard,
  dean: getDeanDashboard,
  career_center: getCareerCenterDashboard,
  company: getCompanyDashboard,
  admin: getAdminDashboard,
}

export function RoleDashboardPage({ session, onLogout }: RoleDashboardPageProps) {
  const role = session.role
  const location = useLocation()
  const [result, setResult] = useState<{
    role: UserRole
    data?: DashboardData
    error?: string
  } | null>(null)

  useEffect(() => {
    let isCurrent = true
    dashboardLoaders[role]()
      .then((data) => { if (isCurrent) setResult({ role, data }) })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setResult({
            role,
            error: loadError instanceof Error
              ? loadError.message
              : 'We could not load your dashboard. Please try again.',
          })
        }
      })
    return () => { isCurrent = false }
  }, [role, location.pathname])

  const currentResult = result?.role === role ? result : null

  if (currentResult?.error) {
    return <main className="dashboard-error"><div><span className="error-mark">!</span><h1>Dashboard unavailable</h1><p>{currentResult.error}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button><button className="text-button" onClick={onLogout}>Sign out</button></div></main>
  }

  if (!currentResult?.data) return <main className="dashboard-loading"><span className="loading-spinner" /><p>Preparing your workspace…</p></main>
  return <DashboardLayout session={session} data={currentResult.data} onLogout={onLogout} />
}
