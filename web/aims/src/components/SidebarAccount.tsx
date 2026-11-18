import { roleLabels, type UserSession } from '../types/auth'

export function SidebarAccount({ session }: { session: UserSession }) {
  const name = session.name.trim() || session.email
  return (
    <div className="sidebar-account">
      <span className="sidebar-account-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <span className="sidebar-account-copy">
        <strong>{name}</strong>
        <small>{roleLabels[session.role]}</small>
      </span>
    </div>
  )
}
