import { AuthIdentity } from './AuthIdentity'
import { Icon } from './Icons'
import { roleDescriptions, roleLabels, roles } from '../types/auth'
import type { UserRole } from '../types/auth'

interface RoleSelectorProps { onSelectRole: (role: UserRole) => void }
const roleIcons: Record<UserRole, 'users' | 'briefcase' | 'chart' | 'settings'> = {
  coordinator: 'users', dean: 'chart', career_center: 'briefcase', company: 'briefcase', admin: 'settings',
}

export function RoleSelector({ onSelectRole }: RoleSelectorProps) {
  return (
    <main className="citc-auth">
      <AuthIdentity />
      <section className="citc-workspace" aria-labelledby="workspace-heading">
        <header className="citc-workspace-top"><span>CITC INTERNSHIP PORTAL</span><span className="citc-access-label"><span />Authorized access</span></header>
        <div className="citc-workspace-content">
          <p className="citc-overline">YOUR WORKSPACE</p>
          <h1 id="workspace-heading">Welcome to AIMS<span>.</span></h1>
          <p className="citc-intro">One internship journey. A shared commitment.<br />Choose your role to access your workspace.</p>
          <div className="citc-role-list">
            {roles.map((role, index) => (
              <button className="citc-role" type="button" key={role} onClick={() => onSelectRole(role)}>
                <span className="citc-role-icon"><Icon name={roleIcons[role]} size={22} /></span>
                <span className="citc-role-copy"><strong>{roleLabels[role]}</strong><small>{roleDescriptions[role]}</small></span>
                <span className="citc-role-number" aria-hidden="true">0{index + 1}</span><Icon name="arrow" size={19} />
              </button>
            ))}
          </div>
          <p className="citc-student-note"><Icon name="users" size={18} /><span>Student intern? Access your internship through the <strong>AIMS mobile app.</strong></span></p>
        </div>
        <footer className="citc-auth-footer"><span>© {new Date().getFullYear()} USTP · CITC</span><span>Academic Internship Management System</span></footer>
      </section>
    </main>
  )
}
