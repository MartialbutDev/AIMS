import { Brand } from './Brand'
import { Icon } from './Icons'
import { roleDescriptions, roleLabels, roles } from '../types/auth'
import type { UserRole } from '../types/auth'

interface RoleSelectorProps {
  onSelectRole: (role: UserRole) => void
}

const roleIcons: Record<UserRole, 'users' | 'briefcase' | 'chart' | 'settings'> = {
  coordinator: 'users',
  dean: 'chart',
  career_center: 'briefcase',
  company: 'briefcase',
  admin: 'settings',
}

export function RoleSelector({ onSelectRole }: RoleSelectorProps) {
  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-content role-content">
          <div className="eyebrow"><span className="eyebrow-dot" /> ONE CAMPUS. EVERY OPPORTUNITY.</div>
          <h1>Welcome to a smarter<br /><span>internship experience.</span></h1>
          <p className="auth-intro">A simpler way to bring students, educators, and employers together. Choose your workspace to get started.</p>
          <div className="role-grid">
            {roles.map((role, index) => (
              <button className={`role-card role-card--${role}`} key={role} onClick={() => onSelectRole(role)}>
                <span className="role-icon"><Icon name={roleIcons[role]} size={19} /></span>
                <span className="role-card-copy">
                  <strong>{roleLabels[role]}</strong>
                  <small>{roleDescriptions[role]}</small>
                </span>
                <span className="role-arrow"><Icon name="arrow" size={17} /></span>
                <span className="role-index">0{index + 1}</span>
              </button>
            ))}
          </div>
          <p className="secure-note"><span className="secure-dot" /> A secure workspace for the USTP community</p>
        </div>
        <footer className="auth-footer"><span>© 2026 USTP AIMS</span><span>Built for better beginnings.</span></footer>
      </section>
      <aside className="auth-aside">
        <div className="aside-orb aside-orb--one" />
        <div className="aside-orb aside-orb--two" />
        <div className="aside-topline"><span>YOUR NEXT CHAPTER STARTS HERE</span><span>01 — 05</span></div>
        <div className="aside-message">
          <span className="aside-kicker">CAREERS, CONNECTED.</span>
          <h2>Where learning<br />meets the <em>real world.</em></h2>
          <p>Every great career begins with an opportunity. Let’s make the connection.</p>
        </div>
        <div className="aside-card">
          <div className="aside-card-icon"><Icon name="briefcase" size={18} /></div>
          <div><strong>One platform. Shared progress.</strong><span>Everything your internship journey needs, in one place.</span></div>
          <span className="aside-card-arrow"><Icon name="arrow" size={17} /></span>
        </div>
        <div className="aside-bottom"><span>UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES</span><div className="aside-pips"><i /><i /><i /><i /><i /></div></div>
      </aside>
    </main>
  )
}
