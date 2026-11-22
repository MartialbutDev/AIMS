import { useUsageActivity } from "./hooks/useUsageActivity"

import {
  Navigate,
  Route,
  Routes,
  useLocation,
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
import { StudentAccess } from './pages/student/StudentAccess'
import { EmailActionPage } from './pages/shared/EmailActionPage'

const ROLE_PATHS: Record<UserRole, string> = {
  student: 'student',
  admin: 'admin',
  coordinator: 'coordinator',
  dean: 'dean',
  career_center: 'career-center',
  company: 'company',
}

const ALLOWED_SECTIONS: Record<UserRole, string[]> = {
  student: ['dashboard', 'onboarding', 'companies', 'applications', 'direct-placements', 'documents', 'forms', 'pre-deployment', 'attendance', 'journals', 'reports', 'completion', 'profile', 'settings', 'help-center'],
  admin: [
    'dashboard',
    'completion',
    'users',
    'company-access',
    'activity-history',
    'coordinators',
    'assignments',
    'document-verification',
    'notifications',
    'announcements',
    'settings',
    'help-center',
  ],

  coordinator: [
    'dtr-corrections',
    'dashboard',
    'completion',
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
    'moa-partners',
    'completion',
    'notifications',
    'settings',
    'help-center',
    'direct-placements',
  ],

  career_center: [
    'dashboard',
    'completion',
    'companies',
    'applications',
    'notifications',
    'settings',
    'help-center',
    'direct-placements',
  ],

  company: [
    'dtr-corrections',
    'dashboard',
    'completion',
    'interns',
    'applications',
    'notifications',
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

type SignInDestination = { pathname: string; search: string; hash: string }

function signInDestination(value: unknown, role: UserRole): SignInDestination | undefined {
  if (!value || typeof value !== 'object' || !('pathname' in value) ||
      !('search' in value) || !('hash' in value)) return
  const { pathname, search, hash } = value
  if (typeof pathname !== 'string' || typeof search !== 'string' || typeof hash !== 'string') return
  if (search && !search.startsWith('?') || hash && !hash.startsWith('#')) return
  const [, workspace, section, ...rest] = pathname.split('/')
  if (!pathname.startsWith('/') || workspace !== ROLE_PATHS[role] || rest.length) return
  if (section && !ALLOWED_SECTIONS[role].includes(section)) return
  return { pathname, search, hash }
}

interface LoginRouteProps {
  isSigningIn: boolean
  login: (
    role: UserRole,
    identifier: string,
    password: string,
    keepSignedIn?: boolean,
  ) => Promise<void>
}

function LoginRoute({
  isSigningIn,
  login,
}: LoginRouteProps) {
  const { role: rolePath } = useParams<{ role: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const role = getRoleFromPath(rolePath)

  if (!role) {
    return <Navigate to="/" replace />
  }

  return (
    <RoleLogin
      role={role}
      reauthenticate={!!signInDestination(location.state?.returnTo, role)}
      isSigningIn={isSigningIn}
      onBack={() => navigate('/')}
      onLogin={(identifier, password, keepSignedIn) =>
        login(role, identifier, password, keepSignedIn)
      }
    />
  )
}

interface DashboardRouteProps {
  session: UserSession | null
  onLogout: () => void
  needsSignIn: boolean
}

function DashboardRoute({
  session,
  onLogout,
  needsSignIn,
}: DashboardRouteProps) {
  const { workspace, section } = useParams<{
    workspace: string
    section?: string
  }>()

  const { pathname, search, hash } = useLocation()
  const requestedRole = getRoleFromPath(workspace)
  if (!session) {
    const returnTo = needsSignIn && requestedRole
      ? signInDestination({ pathname, search, hash }, requestedRole)
      : undefined
    return returnTo && requestedRole
      ? <Navigate to={`/login/${ROLE_PATHS[requestedRole]}`} state={{ returnTo }} replace />
      : <Navigate to="/" replace />
  }

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
      key={session.accessToken}
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
    restoreError,
    needsSignIn,
    retryRestore,
    login,
    logout,
  } = useAuthSession()

  useUsageActivity(isRestoring ? undefined : session?.accessToken)
  const navigate = useNavigate()
  const location = useLocation()

  if (isRestoring) {
    return (
      <main className="dashboard-loading">
        <span className="loading-spinner" />
        <p>Verifying your account…</p>
      </main>
    )
  }

  if (restoreError) {
    return (
      <main className="dashboard-loading" role="alert">
        <p>AIMS could not check your sign-in. Check your connection and try again.</p>
        <button type="button" onClick={() => void retryRestore()}>Try again</button>
      </main>
    )
  }

  const dashboardPath = session
    ? getDashboardPath(session.role)
    : '/'

  const resumePath = session && signInDestination(location.state?.returnTo, session.role)

  return (
    <Routes>
      <Route path="/student-signup" element={session ? <Navigate to={dashboardPath} replace /> : <StudentAccess mode="signup" />} />
      <Route path="/student-forgot-password" element={<StudentAccess mode="reset" />} />
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
            <Navigate to={resumePath || dashboardPath} replace />
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
            needsSignIn={needsSignIn}
          />
        }
      />

      <Route
        path="/:workspace/:section"
        element={
          <DashboardRoute
            session={session}
            onLogout={logout}
            needsSignIn={needsSignIn}
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
