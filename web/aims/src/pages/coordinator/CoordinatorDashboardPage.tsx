
import { useState } from 'react'
import { Icon } from '../../components/Icons'
import type { DashboardData, DashboardMetric } from '../../types/dashboard'
import './coordinator-ui.css'

interface CoordinatorDashboardPageProps {
  data: DashboardData
  name: string
  onNavigate: (section: string) => void
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
      <div className="co-metric-header">
        <span className="co-metric-label">{metric.label}</span>
        <span className={`co-metric-icon co-tone-${metric.tone}`}>
          <Icon name={metric.icon} size={20} />
        </span>
      </div>

      <strong className="co-metric-value">{metric.value}</strong>

      <div className="co-metric-footer">
        <span className={`co-metric-change co-tone-${metric.tone}`}>
          {metric.change}
        </span>
        {onClick && <span className="co-metric-action">View details →</span>}
      </div>
    </>
  )

  return onClick ? (
    <button type="button" className="co-metric-card co-metric-clickable" onClick={onClick}>
      {content}
    </button>
  ) : (
    <article className="co-metric-card">{content}</article>
  )
}

export function CoordinatorDashboardPage({
  data,
  name,
  onNavigate,
}: CoordinatorDashboardPageProps) {
  const [checkedTasks, setCheckedTasks] = useState<string[]>([])

  const chartMaximum = Math.max(...data.chartValues, 1)
  const pendingCount = data.tasks.filter(
    (task) => !checkedTasks.includes(task)
  ).length

  const completedCount = data.tasks.length - pendingCount

  function toggleTask(task: string) {
    setCheckedTasks((current) =>
      current.includes(task)
        ? current.filter((item) => item !== task)
        : [...current, task]
    )
  }

  function metricDestination(metric: DashboardMetric) {
    const label = metric.label.toLowerCase()

    if (label.includes('student')) return 'students'
    if (label.includes('application')) return 'applications'

    return undefined
  }

  return (
    <main className="co-page co-dashboard">
      <section className="co-hero">
        <div className="co-hero-content">
          <span className="co-hero-eyebrow">
            <span className="co-live-dot" />
            COORDINATOR WORKSPACE
          </span>

          <h1>
            {data.greeting}, <span>{name}!</span>
          </h1>

          <p>{data.subtitle}</p>

          <div className="co-hero-actions">
            <button
              type="button"
              className="co-button co-button-primary"
              onClick={() => onNavigate('students')}
            >
              <Icon name="search" size={17} />
              Manage students
            </button>

            <button
              type="button"
              className="co-button co-button-hero-outline"
              onClick={() => onNavigate('notifications')}
            >
              <Icon name="bell" size={17} />
              Notifications
            </button>
          </div>
        </div>

        <div className="co-hero-decoration" aria-hidden="true">
          <div className="co-hero-orbit co-hero-orbit-one" />
          <div className="co-hero-orbit co-hero-orbit-two" />
          <div className="co-hero-symbol">
            <Icon name="check" size={36} />
          </div>
        </div>
      </section>

      <div className="co-section-title">
        <div>
          <span className="co-overline">OVERVIEW</span>
          <h2>Workspace overview</h2>
          <p>Monitor internship activity and important updates.</p>
        </div>
        <span className="co-section-tag">Live workspace data</span>
      </div>

      <section className="co-metrics-grid" aria-label="Coordinator metrics">
        {data.metrics.map((metric) => {
          const destination = metricDestination(metric)

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

      <section className="co-content-grid">
        <article className="co-card co-activity-card">
          <header className="co-card-header">
            <div>
              <span className="co-overline">LATEST UPDATES</span>
              <h2>Recent activity</h2>
              <p>What's happening in your internship workspace</p>
            </div>

            <button
              type="button"
              className="co-text-button"
              onClick={() => onNavigate('applications')}
            >
              View all
              <Icon name="arrow" size={15} />
            </button>
          </header>

          {data.activities.length === 0 ? (
            <div className="co-empty">
              <div className="co-empty-icon">
                <Icon name="bell" size={24} />
              </div>
              <strong>No recent activity</strong>
              <p>New internship activity will appear here.</p>
            </div>
          ) : (
            <div className="co-activity-list">
              {data.activities.slice(0, 6).map((activity, index) => (
                <div
                  className="co-activity-item"
                  key={`${activity.title}-${index}`}
                >
                  <div className={`co-avatar co-tone-${activity.tone}`}>
                    {activity.initials}
                  </div>

                  <div className="co-activity-content">
                    <strong>{activity.title}</strong>
                    <p>{activity.detail}</p>
                  </div>

                  <time className="co-activity-time">{activity.time}</time>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="co-card co-task-card">
          <header className="co-card-header">
            <div>
              <span className="co-overline">YOUR CHECKLIST</span>
              <h2>{data.tasksTitle}</h2>
              <p>Stay organized throughout the day</p>
            </div>

            <span className="co-count-badge">{pendingCount}</span>
          </header>

          {data.tasks.length > 0 && (
            <div className="co-task-progress">
              <div className="co-task-progress-label">
                <span>Checklist progress</span>
                <strong>{completedCount}/{data.tasks.length}</strong>
              </div>
              <div className="co-progress-track">
                <span
                  style={{
                    width: `${(completedCount / data.tasks.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="co-task-list">
            {data.tasks.length === 0 ? (
              <div className="co-empty co-empty-compact">
                <strong>No tasks available</strong>
                <p>Your checklist is currently empty.</p>
              </div>
            ) : (
              data.tasks.map((task, index) => {
                const checked = checkedTasks.includes(task)

                return (
                  <label className="co-task-item" key={`${task}-${index}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTask(task)}
                    />
                    <span className={`co-task-checkbox ${checked ? 'is-checked' : ''}`}>
                      {checked && <Icon name="check" size={13} />}
                    </span>
                    <span className={checked ? 'co-task-done' : ''}>
                      {task}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          <button
            type="button"
            className="co-button co-button-soft co-full-width"
            onClick={() => onNavigate('applications')}
          >
            View applications
            <Icon name="arrow" size={16} />
          </button>
        </article>
      </section>

      <section className="co-card co-chart-card">
        <header className="co-card-header">
          <div>
            <span className="co-overline">ANALYTICS</span>
            <h2>{data.chartTitle}</h2>
            <p>{data.chartCaption}</p>
          </div>
          <span className="co-section-tag">Last 6 months</span>
        </header>

        <div className="co-chart-container">
          <div className="co-chart-y-axis">
            {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
              <span key={fraction}>
                {Math.round(chartMaximum * fraction)}
              </span>
            ))}
          </div>

          <div className="co-chart-main">
            <div className="co-chart-grid" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((line) => (
                <span key={line} />
              ))}
            </div>

            <div className="co-chart-bars">
              {data.chartValues.map((value, index) => (
                <div className="co-chart-column" key={index}>
                  <div className="co-chart-bar-area">
                    <div
                      className={`co-chart-bar ${
                        index === data.chartValues.length - 1
                          ? 'co-chart-bar-active'
                          : ''
                      }`}
                      style={{
                        height: `${Math.max(0, (value / chartMaximum) * 100)}%`,
                      }}
                      title={`${value} applications`}
                    />
                  </div>
                  <span>{data.chartLabels[index] ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="co-footer">
        <span>© 2026 USTP AIMS · Academic Internship Management System</span>
        <span>Coordinator Portal</span>
      </footer>
    </main>
  )
}
