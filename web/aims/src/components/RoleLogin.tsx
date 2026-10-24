import { useState, type FormEvent } from 'react'
import { AuthIdentity } from './AuthIdentity'
import { Icon } from './Icons'
import { roleDescriptions, roleLabels } from '../types/auth'
import type { UserRole } from '../types/auth'

interface RoleLoginProps {
  role: UserRole
  isSigningIn: boolean
  onBack: () => void
  onLogin: (loginIdentifier: string, password: string) => Promise<void>
}

export function RoleLogin({ role, isSigningIn, onBack, onLogin }: RoleLoginProps) {
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSigningIn) return
    setError('')
    try { await onLogin(loginIdentifier, password) }
    catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'We could not sign you in. Please try again.') }
  }

  return (
    <main className="citc-auth">
      <AuthIdentity />
      <section className="citc-workspace" aria-labelledby="login-heading">
        <header className="citc-workspace-top"><span>CITC INTERNSHIP PORTAL</span><span className="citc-access-label"><span />Authorized access</span></header>
        <div className="citc-workspace-content citc-login-content">
          <button className="citc-back" type="button" onClick={onBack} disabled={isSigningIn}><Icon name="arrow" size={17} />All workspaces</button>
          <div className="citc-login-role"><Icon name={role === 'admin' ? 'settings' : role === 'dean' ? 'chart' : role === 'company' || role === 'career_center' ? 'briefcase' : 'users'} size={25} /></div>
          <p className="citc-overline">{roleLabels[role]} WORKSPACE</p>
          <h1 id="login-heading">Welcome back<span>.</span></h1>
          <p className="citc-intro">{roleDescriptions[role]}</p>
          <form className="citc-login-form" onSubmit={handleSubmit} aria-busy={isSigningIn}>
            <label htmlFor="login-identifier">Email or username</label>
            <input id="login-identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={role === 'company' ? 'Your company email or username' : 'Your email or username'} value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} required disabled={isSigningIn} />
            <div className="citc-password-label"><label htmlFor="login-password">Password</label><a href="/forgot-password">Forgot password?</a></div>
            <div className="citc-password-input"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} disabled={isSigningIn} /><button type="button" aria-controls="login-password" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div>
            {error && <p className="citc-login-error" role="alert">{error}</p>}
            <button className="citc-sign-in" type="submit" disabled={isSigningIn}><span>{isSigningIn ? 'Signing in…' : `Sign in as ${roleLabels[role]}`}</span><Icon name="arrow" size={19} /></button>
          </form>
          <p className="citc-account-note">Use the account assigned to your role. For account access assistance, contact your AIMS administrator.</p>
        </div>
        <footer className="citc-auth-footer"><span>© {new Date().getFullYear()} USTP · CITC</span><span>Academic Internship Management System</span></footer>
      </section>
    </main>
  )
}
