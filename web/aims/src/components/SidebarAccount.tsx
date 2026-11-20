import { roleLabels, type UserSession } from '../types/auth'
import { AccountAvatar } from './AccountAvatar'

export function SidebarAccount({ session }: { session: UserSession }) {
  const name = session.name.trim() || session.email
  return (
    <div className="sidebar-account">
      <AccountAvatar className="sidebar-account-avatar" session={session} />
      <span className="sidebar-account-copy">
        <strong>{name}</strong>
        <small>{roleLabels[session.role]}</small>
      </span>
    </div>
  )
}
