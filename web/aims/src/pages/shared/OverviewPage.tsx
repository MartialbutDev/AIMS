import { useState } from 'react'
import { Icon } from '../../components/Icons'
import type {
  DashboardData,
  DashboardMetric,
} from '../../types/dashboard'
import type { UserRole } from '../../types/auth'

interface OverviewPageProps {
  data: DashboardData
  name: string
  role: UserRole
  onNavigate: (section: string) => void
  onAddUser?: () => void
}

function MetricCard({
  metric,
  onClick,
}: {
  metric: DashboardMetric
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="metric-topline">
        <span>{metric.label}</span>
        <span className={`metric-icon metric-icon--${metric.tone}`}>
          <Icon name={metric.icon} size={18} />
        </span>
      </div>

      <strong className="metric-value">{metric.value}</strong>

      <span className={`metric-change metric-change--${metric.tone}`}>
        {metric.change}
      </span>
    </>
  )

  return onClick ? (
    <button
      type="button"
      className="metric-card metric-card--interactive"
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <article className="metric-card">{content}</article>
  )
}

export function OverviewPage({
  data,
  name,
  role,
  onNavigate,
  onAddUser,
}: OverviewPageProps) {
  const [checkedTasks, setCheckedTasks] = useState<string[]>([])

  const chartMaximum = Math.max(...data.chartValues, 0)

  const pendingCount = data.tasks.filter(
    (task) => !checkedTasks.includes(task)
  ).length

  function toggleTask(task: string) {
    setCheckedTasks((current) =>
      current.includes(task)
        ? current.filter((item) => item !== task)
        : [...current, task]
    )
  }

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="welcome-eyebrow">
            <span className="eyebrow-dot" /> YOUR DASHBOARD
          </div>

          <h1>
            {data.greeting}, <span>{name}.</span>
          </h1>

          <p>{data.subtitle}</p>
        </div>

        {role === 'admin' && onAddUser ? (
          <button
            type="button"
            className="outline-button"
            onClick={onAddUser}
          >
            <span className="add-user-plus">+</span> Add user
          </button>
        ) : (
          <button
            type="button"
            className="outline-button"
            onClick={() => onNavigate('notifications')}
          >
            <Icon name="bell" size={17} /> Notifications
          </button>
        )}
      </section>

      <section className="metrics-grid" aria-label="Key metrics">
        {data.metrics.map((metric) => {
          const destination =
            role === 'coordinator' &&
            (metric.label === 'Students' ||
              metric.label === 'Applications')
              ? metric.label.toLowerCase()
              : undefined

          return (
            <MetricCard
              key={metric.label}
              metric={metric}
              onClick={
                destination
                  ? () => onNavigate(destination)
                  : undefined
              }
            />
          )
        })}
      </section>

      <section className="dashboard-columns">
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>The latest updates from your workspace</p>
            </div>

            <button
              type="button"
              className="panel-link"
              onClick={() =>
                onNavigate(
                  role === 'admin'
                    ? 'notifications'
                    : 'applications'
                )
              }
            >
              View all <Icon name="arrow" size={15} />
            </button>
          </div>

          <div className="activity-list">
            {data.activities.length === 0 ? (
              <p className="empty-state">
                No application activity yet.
              </p>
            ) : (
              data.activities.map((activity, index) => (
                <div
                  className="activity-row"
                  key={`${activity.title}-${index}`}
                >
                  <span
                    className={`activity-avatar activity-avatar--${activity.tone}`}
                  >
                    {activity.initials}
                  </span>

                  <span className="activity-copy">
                    <strong>{activity.title}</strong>
                    <small>{activity.detail}</small>
                  </span>

                  <time>{activity.time}</time>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel tasks-panel">
          <div className="panel-heading">
            <div>
              <h2>{data.tasksTitle}</h2>
              <p>Keep things moving forward</p>
            </div>

            <span className="task-count">
              {pendingCount}
            </span>
          </div>

          <ul className="task-list">
            {data.tasks.map((task, index) => (
              <li key={`${task}-${index}`}>
                <button
                  type="button"
                  className={`task-check${
                    checkedTasks.includes(task)
                      ? ' task-check--checked'
                      : ''
                  }`}
                  onClick={() => toggleTask(task)}
                  aria-label={`${
                    checkedTasks.includes(task)
                      ? 'Mark incomplete'
                      : 'Complete'
                  }: ${task}`}
                >
                  {checkedTasks.includes(task) && (
                    <Icon name="check" size={13} />
                  )}
                </button>

                <span
                  className={
                    checkedTasks.includes(task)
                      ? 'task-done'
                      : ''
                  }
                >
                  {task}
                </span>
              </li>
            ))}
          </ul>

          {role !== 'dean' && (
            <button
              type="button"
              className="add-task"
              onClick={() =>
                onNavigate(
                  role === 'admin'
                    ? 'assignments'
                    : 'applications'
                )
              }
            >
              <span>+</span> View{' '}
              {role === 'admin'
                ? 'assignments'
                : 'applications'}
            </button>
          )}
        </article>
      </section>

      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>{data.chartTitle}</h2>
            <p>{data.chartCaption}</p>
          </div>

          <span className="period-label">
            Last 6 months
          </span>
        </div>

        <div className="chart-area">
          <div className="chart-y-labels">
            {[1, 0.75, 0.5, 0.25].map((fraction) => (
              <span key={fraction}>
                {Math.round(
                  chartMaximum * fraction
                ).toLocaleString()}
              </span>
            ))}
          </div>

          <div className="chart-plot">
            <div className="chart-grid-lines">
              <i /><i /><i /><i />
            </div>

            <div className="chart-bars">
              {data.chartValues.map((value, index) => (
                <div
                  className="chart-column"
                  key={index}
                >
                  <div
                    className={`chart-bar${
                      index === data.chartValues.length - 1
                        ? ' chart-bar--highlight'
                        : ''
                    }`}
                    style={{
                      height: chartMaximum
                        ? `${(value / chartMaximum) * 100}%`
                        : '0%',
                    }}
                    title={`${value} applications`}
                  />
                </div>
              ))}
            </div>

            <div className="chart-x-labels">
              {data.chartLabels.map((label, index) => (
                <span key={index}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>
          © 2026 USTP AIMS · Internship Management System
        </span>
        <span>Made for the next generation.</span>
      </footer>
    </>
  )
}

export function ApplicationActivityPage({
  data,
}: {
  data: DashboardData
}) {
  return (
    <section className="workspace-page">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" /> LIVE DATABASE DATA
          </span>
          <h1>Applications & placements</h1>
          <p>
            Recent application records and current placement totals.
          </p>
        </div>
      </div>

      <section
        className="metrics-grid"
        aria-label="Application metrics"
      >
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <article className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent application activity</h2>
            <p>
              Latest records available to your workspace
            </p>
          </div>
        </div>

        <div className="activity-list">
          {data.activities.length === 0 ? (
            <p className="empty-state">
              No application activity yet.
            </p>
          ) : (
            data.activities.map((activity, index) => (
              <div
                className="activity-row"
                key={`${activity.title}-${index}`}
              >
                <span
                  className={`activity-avatar activity-avatar--${activity.tone}`}
                >
                  {activity.initials}
                </span>

                <span className="activity-copy">
                  <strong>{activity.title}</strong>
                  <small>{activity.detail}</small>
                </span>

                <time>{activity.time}</time>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}