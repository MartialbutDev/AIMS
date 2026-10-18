
import { Icon } from '../../components/Icons'

import type {
  DashboardData,
  DashboardMetric,
} from '../../types/dashboard'

interface ApplicationsPageProps {
  data: DashboardData
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

export function ApplicationsPage({
  data,
}: ApplicationsPageProps) {
  return (
    <section className="workspace-page">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            LIVE DATABASE DATA
          </span>

          <h1>Applications &amp; placements</h1>

          <p>
            Recent application records and current
            placement totals.
          </p>
        </div>
      </div>

      <section
        className="metrics-grid"
        aria-label="Application metrics"
      >
        {data.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
          />
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
