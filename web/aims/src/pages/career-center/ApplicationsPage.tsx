
import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icons'
import type {
  DashboardData,
  DashboardMetric,
} from '../../types/dashboard'
import './career-center-ui.css'

interface ApplicationsPageProps {
  data: DashboardData
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <article className="cc-stat-card">
      <div className="metric-topline">
        <span className="cc-stat-label">{metric.label}</span>
        <span className={`metric-icon metric-icon--${metric.tone}`}>
          <Icon name={metric.icon} size={18} />
        </span>
      </div>

      <strong className="cc-stat-value">{metric.value}</strong>
      <span className="cc-stat-detail">{metric.change}</span>
    </article>
  )
}

export function ApplicationsPage({ data }: ApplicationsPageProps) {
  const [search, setSearch] = useState('')

  const activities = useMemo(() => {
    const query = search.trim().toLowerCase()

    return data.activities.filter((activity) =>
      `${activity.title} ${activity.detail}`
        .toLowerCase()
        .includes(query)
    )
  }, [data.activities, search])

  return (
    <main className="cc-page">
      <header className="cc-page-header">
        <div>
          <div className="cc-eyebrow">
            <span className="cc-eyebrow-dot" />
            CAREER CENTER · APPLICATION MONITORING
          </div>

          <h1>Applications & Placements</h1>
          <p>
            Monitor internship application statistics and recent
            placement-related activity.
          </p>
        </div>
      </header>

      <section className="cc-stats">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="cc-card cc-directory">
        <div className="cc-section-header">
          <div>
            <span className="cc-section-kicker">APPLICATION RECORDS</span>
            <h2>Recent Activity</h2>
            <p>
              Updates currently available through your dashboard analytics.
            </p>
          </div>

          <span className="cc-counter">
            {activities.length} records
          </span>
        </div>

        <div className="cc-toolbar">
          <label className="cc-search">
            <Icon name="search" size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search application activity..."
              aria-label="Search application activity"
            />
          </label>
        </div>

        {activities.length === 0 ? (
          <div className="cc-empty">
            <strong>No application activity found</strong>
            <p>
              {search
                ? 'Try a different search term.'
                : 'Application updates will appear when available.'}
            </p>
          </div>
        ) : (
          <div className="activity-list">
            {activities.map((activity, index) => (
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
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
