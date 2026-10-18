
import { useState } from 'react'
import { Icon } from '../../components/Icons'

import type {
  DashboardData,
  DashboardMetric,
} from '../../types/dashboard'

interface CompanyDashboardPageProps {
  data: DashboardData
  name: string
  onNavigate: (section: string) => void
}

function MetricCard({
  metric,
}: {
  metric: DashboardMetric
}) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <span>{metric.label}</span>

        <span
          className={`metric-icon metric-icon--${metric.tone}`}
        >
          <Icon name={metric.icon} size={18} />
        </span>
      </div>

      <strong className="metric-value">
        {metric.value}
      </strong>

      <span
        className={`metric-change metric-change--${metric.tone}`}
      >
        {metric.change}
      </span>
    </article>
  )
}

export function CompanyDashboardPage({
  data,
  name,
  onNavigate,
}: CompanyDashboardPageProps) {
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
      {/* WELCOME HEADER */}

      <section className="welcome-row">
        <div>
          <div className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            YOUR DASHBOARD
          </div>

          <h1>
            {data.greeting}, <span>{name}.</span>
          </h1>

          <p>{data.subtitle}</p>
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={() => onNavigate('notifications')}
        >
          <Icon name="bell" size={17} />
          {' '}Notifications
        </button>
      </section>

      {/* DASHBOARD METRICS */}

      <section
        className="metrics-grid"
        aria-label="Key metrics"
      >
        {data.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
          />
        ))}
      </section>

      {/* ACTIVITY AND TASKS */}

      <section className="dashboard-columns">
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>

              <p>
                The latest updates from your workspace
              </p>
            </div>

            <button
              type="button"
              className="panel-link"
              onClick={() => onNavigate('applications')}
            >
              View all
              {' '}
              <Icon name="arrow" size={15} />
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

        {/* TASK CHECKLIST */}

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
            {data.tasks.map((task, index) => {
              const isChecked = checkedTasks.includes(task)

              return (
                <li key={`${task}-${index}`}>
                  <button
                    type="button"
                    className={`task-check${
                      isChecked
                        ? ' task-check--checked'
                        : ''
                    }`}
                    onClick={() => toggleTask(task)}
                    aria-label={`${
                      isChecked
                        ? 'Mark incomplete'
                        : 'Complete'
                    }: ${task}`}
                  >
                    {isChecked && (
                      <Icon name="check" size={13} />
                    )}
                  </button>

                  <span
                    className={
                      isChecked ? 'task-done' : ''
                    }
                  >
                    {task}
                  </span>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            className="add-task"
            onClick={() => onNavigate('applications')}
          >
            <span>+</span>
            {' '}View applications
          </button>
        </article>
      </section>

      {/* ACTIVITY CHART */}

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
              <i />
              <i />
              <i />
              <i />
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
                <span key={index}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}

      <footer className="dashboard-footer">
        <span>
          © 2026 USTP AIMS · Internship Management System
        </span>

        <span>Made for the next generation.</span>
      </footer>
    </>
  )
}
