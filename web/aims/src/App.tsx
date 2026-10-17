import { useState } from 'react'
import { RoleLogin } from './components/RoleLogin'
import { RoleSelector } from './components/RoleSelector'
import { RoleDashboardPage } from './pages/RoleDashboardPage'
import { useAuthSession } from './hooks/useAuthSession'
import type { UserRole } from './types/auth'
import './App.css'

function App() {
  const { session, isSigningIn, isRestoring, login, logout } = useAuthSession()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

  if (isRestoring) {
    return <main className="dashboard-loading"><span className="loading-spinner" /><p>Verifying your account…</p></main>
  }

  if (session) return <RoleDashboardPage session={session} onLogout={logout} />

  if (selectedRole) {
    return <RoleLogin role={selectedRole} isSigningIn={isSigningIn} onBack={() => setSelectedRole(null)} onLogin={(email, password) => login(selectedRole, email, password)} />
  }

  return <RoleSelector onSelectRole={setSelectedRole} />
}

export default App
