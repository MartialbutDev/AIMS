import { useState, type FormEvent } from 'react'
import { Brand } from './Brand'
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
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      await onLogin(loginIdentifier, password)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'We could not sign you in. Please try again.')
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-content login-content">
          <button className="back-link" type="button" onClick={onBack}><Icon name="arrow" size={16} /> All workspaces</button>
          <div className={`login-symbol login-symbol--${role}`}><Icon name={role === 'admin' ? 'settings' : role === 'dean' ? 'chart' : role === 'company' ? 'briefcase' : 'users'} size={22} /></div>
          <span className="login-kicker">SIGN IN TO YOUR WORKSPACE</span>
          <h1>{roleLabels[role]}<br /><span>portal</span></h1>
          <p className="auth-intro">{roleDescriptions[role]}</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email or username</label>
            <input id="email" type="text" autoComplete="username" placeholder={role === 'admin' ? 'admin or email address' : 'you@ustp.edu.ph'} value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} required />
            <div className="password-label"><label htmlFor="password">Password</label><button type="button" className="text-button" onClick={() => setError('Password reset will be available when backend authentication is connected.')}>Forgot password?</button></div>
            <input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={isSigningIn}>{isSigningIn ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={17} /></button>
          </form>
          <p className="demo-hint"><span className="secure-dot" /> Sign-in requires an active account in the AIMS database.</p>
        </div>
        <footer className="auth-footer"><span>© 2026 USTP AIMS</span><button className="footer-link" type="button" onClick={() => setError('For account assistance, please contact your AIMS administrator.')}>Need help?</button></footer>
      </section>
      <aside className="auth-aside auth-aside--login">
        <div className="aside-orb aside-orb--one" /><div className="aside-orb aside-orb--two" />
        <div className="aside-topline"><span>USTP · AIMS</span><span>WELCOME BACK</span></div>
        <div className="login-quote"><span className="quote-mark">“</span><h2>Make every<br />experience <em>count.</em></h2><p>Progress happens when the right people and the right opportunities come together.</p></div>
        <div className="login-aside-foot"><span>ACADEMIC INTERNSHIP MANAGEMENT SYSTEM</span><span>USTP · PHILIPPINES</span></div>
      </aside>
    </main>
  )
}
