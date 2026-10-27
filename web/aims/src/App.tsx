
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { RoleLogin } from './components/RoleLogin'
import { RoleSelector } from './components/RoleSelector'
import { RoleDashboardPage } from './pages/RoleDashboardPage'
import { readAdminLandingPage } from './pages/admin/SettingsPage'
import { useAuthSession } from './hooks/useAuthSession'

import type { UserRole, UserSession } from './types/auth'

import './App.css'
import { EmailActionPage } from './pages/shared/EmailActionPage'

const ROLE_PATHS: Record<UserRole, string> = {
  admin: 'admin',
  coordinator: 'coordinator',
  dean: 'dean',
  career_center: 'career-center',
  company: 'company',
}

const ALLOWED_SECTIONS: Record<UserRole, string[]> = {
  admin: [
    'dashboard',
    'users',
    'assignments',
    'document-verification',
    'notifications',
    'developer-info',
    'settings',
    'help-center',
  ],

  coordinator: [
    'dashboard',
    'students',
    'historical-students',
    'document-templates',
    'applications',
    'document-verification',
    'notifications',
    'settings',
    'help-center',
    'direct-placements',
  ],

  dean: [
    'dashboard',
    'coordinators',
    'notifications',
    'settings',
    'help-center',
    'direct-placements',
  ],

  career_center: [
    'dashboard',
    'companies',
    'applications',
    'notifications',
    'developer-info',
    'settings',
    'help-center',
    'direct-placements',
  ],

  company: [
    'dashboard',
    'interns',
    'applications',
    'notifications',
    'developer-info',
    'settings',
    'help-center',
  ],
}

function getRoleFromPath(value?: string): UserRole | null {
  const role = (Object.keys(ROLE_PATHS) as UserRole[]).find(
    (item) => ROLE_PATHS[item] === value,
  )

  return role ?? null
}

function getDashboardPath(role: UserRole): string {
  return role === 'admin'
    ? `/${ROLE_PATHS[role]}/${readAdminLandingPage()}`
    : `/${ROLE_PATHS[role]}/dashboard`
}

interface LoginRouteProps {
  isSigningIn: boolean
  login: (
    role: UserRole,
    identifier: string,
    password: string,
  ) => Promise<void>
}

function LoginRoute({
  isSigningIn,
  login,
}: LoginRouteProps) {
  const { role: rolePath } = useParams<{ role: string }>()
  const navigate = useNavigate()
  const role = getRoleFromPath(rolePath)

  if (!role) {
    return <Navigate to="/" replace />
  }

  return (
    <RoleLogin
      role={role}
      isSigningIn={isSigningIn}
      onBack={() => navigate('/')}
      onLogin={(identifier, password) =>
        login(role, identifier, password)
      }
    />
  )
}

interface DashboardRouteProps {
  session: UserSession | null
  onLogout: () => void
}

function DashboardRoute({
  session,
  onLogout,
}: DashboardRouteProps) {
  const { workspace, section } = useParams<{
    workspace: string
    section?: string
  }>()

  if (!session) {
    return <Navigate to="/" replace />
  }

  const requestedRole = getRoleFromPath(workspace)

  if (!requestedRole || requestedRole !== session.role) {
    return (
      <Navigate
        to={getDashboardPath(session.role)}
        replace
      />
    )
  }

  if (!section) {
    return (
      <Navigate
        to={getDashboardPath(session.role)}
        replace
      />
    )
  }

  if (!ALLOWED_SECTIONS[session.role].includes(section)) {
    return (
      <Navigate
        to={getDashboardPath(session.role)}
        replace
      />
    )
  }

  return (
    <RoleDashboardPage
      session={session}
      onLogout={onLogout}
    />
  )
}

function App() {
  const {
    session,
    isSigningIn,
    isRestoring,
    login,
    logout,
  } = useAuthSession()

  const navigate = useNavigate()

  if (isRestoring) {
    return (
      <main className="dashboard-loading">
        <span className="loading-spinner" />
        <p>Verifying your account…</p>
      </main>
    )
  }

  const dashboardPath = session
    ? getDashboardPath(session.role)
    : '/'

  return (
    <Routes>
      <Route path="/forgot-password" element={<EmailActionPage mode="forgot" />} />
      <Route path="/reset-password" element={<EmailActionPage mode="reset" />} />
      <Route path="/verify-email" element={<EmailActionPage mode="verify" />} />
      <Route
        path="/"
        element={
          session ? (
            <Navigate to={dashboardPath} replace />
          ) : (
            <RoleSelector
              onSelectRole={(role) =>
                navigate(`/login/${ROLE_PATHS[role]}`)
              }
            />
          )
        }
      />

      <Route
        path="/login"
        element={<Navigate to="/" replace />}
      />

      <Route
        path="/login/:role"
        element={
          session ? (
            <Navigate to={dashboardPath} replace />
          ) : (
            <LoginRoute
              isSigningIn={isSigningIn}
              login={login}
            />
          )
        }
      />

      <Route
        path="/:workspace"
        element={
          <DashboardRoute
            session={session}
            onLogout={logout}
          />
        }
      />

      <Route
        path="/:workspace/:section"
        element={
          <DashboardRoute
            session={session}
            onLogout={logout}
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate to={dashboardPath} replace />
        }
      />
    </Routes>
  )
}

export default App
