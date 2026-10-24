import { useNavigate } from 'react-router-dom'

import type { UserSession } from '../../types/auth'
import { Icon } from '../../components/Icons'


export { AccountEditor as AccountSettingsPage } from './AccountEditor'

export function HelpCenterPage({
  session,
}: {
  session: UserSession
}) {
  const navigate = useNavigate()

  const workspace =
    session.role === 'career_center'
      ? 'career-center'
      : session.role

  return (
    <section className="workspace-page">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" /> SUPPORT
          </span>
          <h1>Help center</h1>
          <p>Guidance for navigating your AIMS workspace.</p>
        </div>
      </div>

      <article
        className="panel"
        style={{ padding: 24, maxWidth: 780 }}
      >
        <h2 style={{ marginTop: 0 }}>Getting started</h2>

        <p>
          Use the sidebar to open the sections available to your role.
          Your dashboard summarizes the latest information returned
          by AIMS.
        </p>

        <p>
          If a page fails to load, check your connection and sign in
          again. If the problem persists, contact your institution's
          AIMS administrator.
        </p>

        <h2>Account security</h2>

        <p>
          Never share your password or authentication tokens.
          Sign out after using a shared computer.
        </p>

        <button
          type="button"
          className="outline-button"
          onClick={() => navigate(`/${workspace}/dashboard`)}
        >
          <Icon name="arrow" size={16} /> Return to dashboard
        </button>
      </article>
    </section>
  )
}