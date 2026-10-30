
import { Icon } from '../../components/Icons'
import type { DashboardData } from '../../types/dashboard'

interface AdminDashboardPageProps {
  data: DashboardData
  name: string
  onNavigate: (section: string) => void
  onAddUser: () => void
}

const toneColors = {
  blue: '#2563eb',
  violet: '#7c3aed',
  amber: '#d97706',
  green: '#059669',
}

const toneBackgrounds = {
  blue: '#eff6ff',
  violet: '#f5f3ff',
  amber: '#fffbeb',
  green: '#ecfdf5',
}

export function AdminDashboardPage({
  data,
  name,
  onNavigate,
  onAddUser,
}: AdminDashboardPageProps) {
  const maxChartValue = Math.max(
    1,
    ...data.chartValues.map((value) =>
      Number.isFinite(value) ? Math.max(0, value) : 0
    )
  )

  return (
    <section className="workspace-page admin-dashboard-page">
      {/* PAGE HEADER */}

      <div className="workspace-page-heading admin-dashboard-header">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            CITC / SYSTEM ADMINISTRATION
          </span>

          <h1>
            Administration desk
          </h1>

          <p>
            {name ? `${name}, manage the people and access behind every internship.` : 'Manage the people and access behind every internship.'}
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={onAddUser}
        >
          <Icon name="users" size={17} />
          Add User
        </button>
      </div>

      <section className="stake-admin-desk" aria-label="Administration priorities">
        <div className="stake-admin-desk-title"><span className="stake-kicker">THE ACADEMIC OPERATIONS DESK</span><h2>One system.<br />Every stakeholder connected.</h2><p>Maintain accounts, coordinator rosters, and student onboarding in one workspace.</p></div>
        <div className="stake-admin-register">
          <button type="button" onClick={() => onNavigate('users')}><span>01</span><div><strong>Account directory</strong><small>Stakeholder accounts and user imports</small></div><Icon name="arrow" size={18} /></button>
          <button type="button" onClick={() => onNavigate('assignments')}><span>02</span><div><strong>Assignment register</strong><small>Student-to-coordinator rosters</small></div><Icon name="arrow" size={18} /></button>
          <button type="button" onClick={() => onNavigate('document-verification')}><span>03</span><div><strong>Onboarding review</strong><small>Orientation certificates and CORs</small></div><Icon name="arrow" size={18} /></button>
        </div>
      </section>

      {/* DASHBOARD METRICS */}

      <div
        className="admin-dashboard-metrics"
        aria-label="Dashboard metrics"
      >
        {data.metrics.map((metric, index) => (
          <article
            className="panel admin-dashboard-metric"
            key={`${metric.label}-${index}`}
          >
            <div className="admin-dashboard-metric-top">
              <span
                className="admin-dashboard-metric-icon"
                style={{
                  color: toneColors[metric.tone],
                  backgroundColor: toneBackgrounds[metric.tone],
                }}
              >
                <Icon name={metric.icon} size={21} />
              </span>

              {metric.change && (
                <span className="admin-dashboard-metric-change">
                  {metric.change}
                </span>
              )}
            </div>

            <strong className="admin-dashboard-metric-value">
              {metric.value}
            </strong>

            <span className="admin-dashboard-metric-label">
              {metric.label}
            </span>
          </article>
        ))}
      </div>

      {/* MAIN DASHBOARD CONTENT */}

      <div className="admin-dashboard-main-grid">
        {/* ANALYTICS CHART */}

        <section className="panel admin-dashboard-chart-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {data.chartTitle || 'System Overview'}
              </h2>

              <p>{data.chartCaption}</p>
            </div>
          </div>

          {data.chartValues.length === 0 ? (
            <p className="empty-state">
              No chart data is available.
            </p>
          ) : (
            <div
              className="admin-dashboard-chart"
              aria-label={data.chartTitle || 'Dashboard chart'}
            >
              {data.chartValues.map((value, index) => {
                const safeValue = Number.isFinite(value)
                  ? Math.max(0, value)
                  : 0

                const height =
                  safeValue === 0
                    ? 0
                    : Math.max(
                        5,
                        (safeValue / maxChartValue) * 100
                      )

                const label =
                  data.chartLabels[index] ??
                  `Item ${index + 1}`

                return (
                  <div
                    className="admin-dashboard-chart-item"
                    key={`${label}-${index}`}
                  >
                    <div className="admin-dashboard-chart-value">
                      {safeValue.toLocaleString()}
                    </div>

                    <div className="admin-dashboard-chart-track">
                      <div
                        className="admin-dashboard-chart-bar"
                        style={{
                          height: `${height}%`,
                        }}
                        role="img"
                        aria-label={`${label}: ${safeValue}`}
                      />
                    </div>

                    <span className="admin-dashboard-chart-label">
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* TASKS */}

        <section className="panel admin-dashboard-tasks-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {data.tasksTitle || 'Tasks and Reminders'}
              </h2>

              <p>Important administrative priorities</p>
            </div>
          </div>

          {data.tasks.length === 0 ? (
            <p className="empty-state">
              No tasks are currently available.
            </p>
          ) : (
            <ul className="admin-dashboard-task-list">
              {data.tasks.map((task, index) => (
                <li key={`${task}-${index}`}>
                  <span className="admin-dashboard-task-marker">
                    <Icon name="check" size={15} />
                  </span>

                  <span>{task}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="admin-dashboard-text-action"
            onClick={() => onNavigate('assignments')}
          >
            Manage Student Assignments
            <Icon name="arrow" size={15} />
          </button>
        </section>
      </div>

      {/* RECENT ACTIVITY AND QUICK ACTIONS */}

      <div className="admin-dashboard-bottom-grid">
        {/* RECENT ACTIVITIES */}

        <section className="panel admin-dashboard-activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest activity available in the dashboard</p>
            </div>
          </div>

          {data.activities.length === 0 ? (
            <p className="empty-state">
              No recent activities are available.
            </p>
          ) : (
            <div className="admin-dashboard-activity-list">
              {data.activities.map((activity, index) => (
                <article
                  className="admin-dashboard-activity"
                  key={`${activity.title}-${index}`}
                >
                  <span
                    className="admin-dashboard-avatar"
                    style={{
                      backgroundColor:
                        toneBackgrounds[activity.tone],
                      color: toneColors[activity.tone],
                    }}
                  >
                    {activity.initials}
                  </span>

                  <div className="admin-dashboard-activity-content">
                    <strong>{activity.title}</strong>
                    <p>{activity.detail}</p>
                  </div>

                  <time className="admin-dashboard-activity-time">
                    {activity.time}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* QUICK ACTIONS */}

        <section className="panel admin-dashboard-actions-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick Actions</h2>
              <p>Access common administrator functions</p>
            </div>
          </div>

          <div className="admin-dashboard-action-list">
            <button
              type="button"
              onClick={onAddUser}
            >
              <span className="admin-dashboard-action-icon">
                <Icon name="users" size={18} />
              </span>

              <span>
                <strong>Add New User</strong>
                <small>Create a stakeholder account</small>
              </span>

              <Icon name="arrow" size={16} />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('users')}
            >
              <span className="admin-dashboard-action-icon">
                <Icon name="users" size={18} />
              </span>

              <span>
                <strong>Manage Users</strong>
                <small>View accounts and import users</small>
              </span>

              <Icon name="arrow" size={16} />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('assignments')}
            >
              <span className="admin-dashboard-action-icon">
                <Icon name="briefcase" size={18} />
              </span>

              <span>
                <strong>Student Assignments</strong>
                <small>Manage coordinator rosters</small>
              </span>

              <Icon name="arrow" size={16} />
            </button>

            {/* NEW: ONBOARDING DOCUMENT VERIFICATION */}

            <button
              type="button"
              onClick={() => onNavigate('document-verification')}
              aria-label="Verify pending onboarding documents"
            >
              <span className="admin-dashboard-action-icon">
                <Icon name="file" size={18} />
              </span>

              <span>
                <strong>Verify Documents</strong>
                <small>
                  Review pending Orientation Certificates and CORs
                </small>
              </span>

              <Icon name="arrow" size={16} />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('announcements')}
            >
              <span className="admin-dashboard-action-icon">
                <Icon name="bell" size={18} />
              </span>

              <span>
                <strong>Announcements</strong>
                <small>Send and schedule announcements</small>
              </span>

              <Icon name="arrow" size={16} />
            </button>
          </div>
        </section>
      </div>

      {/* PAGE-SPECIFIC STYLES */}

      <style>{`
        .admin-dashboard-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .admin-dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .admin-dashboard-header .primary-button {
          display: inline-flex;
          align-items: center;
          gap: 9px;
        }

        .admin-dashboard-metrics {
          display: grid;
          grid-template-columns:
            repeat(auto-fit, minmax(190px, 1fr));
          gap: 18px;
        }

        .admin-dashboard-metric {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 22px;
          min-width: 0;
        }

        .admin-dashboard-metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .admin-dashboard-metric-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 13px;
        }

        .admin-dashboard-metric-change {
          font-size: 12px;
          color: #64748b;
          text-align: right;
        }

        .admin-dashboard-metric-value {
          font-size: 29px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .admin-dashboard-metric-label {
          font-size: 13px;
          color: #64748b;
        }

        .admin-dashboard-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
          gap: 20px;
        }

        .admin-dashboard-bottom-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
          gap: 20px;
        }

        .admin-dashboard-chart-panel,
        .admin-dashboard-tasks-panel,
        .admin-dashboard-activity-panel,
        .admin-dashboard-actions-panel {
          padding: 24px;
          min-width: 0;
        }

        .admin-dashboard-chart {
          display: flex;
          align-items: stretch;
          justify-content: space-around;
          gap: 12px;
          min-height: 260px;
          padding-top: 20px;
          overflow-x: auto;
        }

        .admin-dashboard-chart-item {
          display: flex;
          flex: 1 0 45px;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          min-width: 45px;
          max-width: 110px;
        }

        .admin-dashboard-chart-value {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .admin-dashboard-chart-track {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          width: 100%;
          height: 175px;
        }

        .admin-dashboard-chart-bar {
          width: 65%;
          margin: 0 auto;
          background: linear-gradient(
            180deg,
            #3b82f6 0%,
            #2563eb 100%
          );
          border-radius: 7px 7px 0 0;
          min-height: 0;
        }

        .admin-dashboard-chart-label {
          font-size: 11px;
          color: #64748b;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .admin-dashboard-task-list {
          list-style: none;
          margin: 20px 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .admin-dashboard-task-list li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 13px;
          line-height: 1.6;
        }

        .admin-dashboard-task-marker {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          color: #059669;
          background: #ecfdf5;
        }

        .admin-dashboard-text-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          color: #2563eb;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          padding: 8px 0;
        }

        .admin-dashboard-activity-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .admin-dashboard-activity {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .admin-dashboard-activity:last-child {
          border-bottom: 0;
        }

        .admin-dashboard-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
        }

        .admin-dashboard-activity-content {
          flex: 1;
          min-width: 0;
        }

        .admin-dashboard-activity-content strong {
          display: block;
          font-size: 13px;
        }

        .admin-dashboard-activity-content p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .admin-dashboard-activity-time {
          color: #94a3b8;
          font-size: 11px;
          white-space: nowrap;
        }

        .admin-dashboard-action-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .admin-dashboard-action-list button {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }

        .admin-dashboard-action-list button:hover {
          border-color: #93c5fd;
          background: #eff6ff;
        }

        .admin-dashboard-action-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 39px;
          height: 39px;
          border-radius: 10px;
          color: #2563eb;
          background: #eff6ff;
        }

        .admin-dashboard-action-list button > span:nth-child(2) {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .admin-dashboard-action-list strong {
          font-size: 13px;
        }

        .admin-dashboard-action-list small {
          color: #64748b;
          font-size: 11px;
        }

        @media (max-width: 900px) {
          .admin-dashboard-main-grid,
          .admin-dashboard-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .admin-dashboard-chart-panel,
          .admin-dashboard-tasks-panel,
          .admin-dashboard-activity-panel,
          .admin-dashboard-actions-panel {
            padding: 16px;
          }

          .admin-dashboard-activity {
            flex-wrap: wrap;
          }

          .admin-dashboard-activity-time {
            margin-left: 50px;
          }
        }
      `}</style>
    </section>
  )
}
