import { ApplicationActivityChart } from './ApplicationActivityChart'
import { internshipMetrics } from '../../services/analyticsService'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icons'
import {
  getCareerCompanies,
  type CareerCompany,
} from '../../services/careerCenterService'
import { daysUntilMoaExpiry, formatMoaDate, getMoaStatus, moaDaysLeftLabel, MOA_EXPIRING_WITHIN_DAYS } from '../../services/moaExpiry'
import type { DashboardData } from '../../types/dashboard'
import './career-center-ui.css'

interface CareerDashboardPageProps {
  data: DashboardData
  onNavigate: (section: string) => void
}

export function CareerDashboardPage({
  data,
  onNavigate,
}: CareerDashboardPageProps) {
  const [companies, setCompanies] = useState<CareerCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getCareerCompanies()
      .then((result) => {
        if (active) setCompanies(result)
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load partnership statistics.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const active = companies.filter((company) => company.is_active)
    const counts = { signed: 0, expired: 0, pending: 0 }
    const expiring: CareerCompany[] = []
    const now = new Date()
    for (const company of active) {
      const status = getMoaStatus(company, now)
      if (status === 'expiring') expiring.push(company)
      else counts[status]++
    }
    expiring.sort((left, right) => (left.moa_expires_at ?? '').localeCompare(right.moa_expires_at ?? ''))
    return { ...counts, total: active.length, expiring }
  }, [companies])

  return (
    <main className="cc-page">
      <header className="cc-page-header">
        <div>
          <h1>
            Career Center overview
          </h1>

        </div>

        <div className="cc-header-actions">
          <button
            type="button"
            className="cc-button cc-button-secondary"
            onClick={() => onNavigate('notifications')}
          >
            <Icon name="bell" size={16} />
            Notifications
          </button>

          <button
            type="button"
            className="cc-button cc-button-primary"
            onClick={() => onNavigate('companies')}
          >
            Manage companies
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </header>

      <section className="stake-career-brief" aria-label="Partnership agreement priorities">
        <div>
          <h2>Partner companies</h2>
          <p>Company profiles and signed MOAs.</p>
          <button type="button" className="stake-yellow-button" onClick={() => onNavigate('companies')}>
            View companies <Icon name="arrow" size={17} />
          </button>
        </div>
        <div className="stake-renewal-brief"><span>MOA status</span><strong>{loading || error ? '—' : stats.expiring.length}<small>expiring within {MOA_EXPIRING_WITHIN_DAYS} days</small></strong><p>{loading ? 'Loading MOAs…' : error ? 'MOA data unavailable.' : (stats.expired + ' expired · ' + stats.pending + ' unsigned')}</p><button type="button" onClick={() => onNavigate('companies')}>Review agreements <Icon name="arrow" size={16} /></button></div>
      </section>

      {error && (
        <div className="cc-alert cc-alert-error" role="alert">
          {error}
        </div>
      )}

      <section className="cc-stats">
        {[
          ['Active partners', stats.total, 'All terms'],
          ['Current MOAs', stats.signed, `No expiry within ${MOA_EXPIRING_WITHIN_DAYS} days`],
          ['Unsigned MOAs', stats.pending, ''],
          ['Expiring soon', stats.expiring.length, `Within ${MOA_EXPIRING_WITHIN_DAYS} days`],
          ['Expired MOAs', stats.expired, ''],
        ].map(([label, value, detail]) => (
          <article className="cc-stat-card" key={String(label)}>
            <span className="cc-stat-label">{label}</span>
            <strong className="cc-stat-value">
              {loading || error ? '—' : value}
            </strong>
            {detail && <span className="cc-stat-detail">{detail}</span>}
          </article>
        ))}
        {internshipMetrics(data).map(metric => (
          <article className="cc-stat-card" key={metric.label}>
            <span className="cc-stat-label">{metric.label}</span>
            <strong className="cc-stat-value">{metric.value}</strong>
            <span className="cc-stat-detail">{metric.change}</span>
          </article>
        ))}
      </section>

      <ApplicationActivityChart key={(data.academic_year ?? '') + (data.semester ?? '')} activity={data.application_activity}
        term={data.academic_year && data.semester ? 'AY ' + data.academic_year + ' · Semester ' + data.semester + '.' : 'Dashboard academic term.'} />

      <section className="cc-bottom-grid stake-partnership-grid">
        <article className="cc-card cc-info-card cc-application-records">
          <div className="cc-section-header">
            <div>
              <h2>Recent applications</h2>
            </div>
            <button
              type="button"
              className="cc-button cc-button-secondary"
              onClick={() => onNavigate('applications')}
            >
              View all
            </button>
          </div>

          {data.activities.length === 0 ? (
            <div className="cc-mini-empty">
              No recent applications.
            </div>
          ) : (
            <div className="activity-list">
              {data.activities.slice(0, 5).map((activity, index) => (
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
        </article>

        <article className="cc-card cc-info-card">
          <div className="cc-section-header">
            <div>
              <h2>MOA Monitoring</h2>
              <p>Expiring within {MOA_EXPIRING_WITHIN_DAYS} days.</p>
            </div>
          </div>

          {error ? <div className="cc-mini-empty">MOA data unavailable. Refresh the page.</div> : loading ? (
            <div className="cc-mini-empty">
              Loading MOAs…
            </div>
          ) : stats.expiring.length === 0 ? (
            <div className="cc-mini-empty">
              No MOAs expire within {MOA_EXPIRING_WITHIN_DAYS} days.
            </div>
          ) : (
            <div className="cc-watch-list">
              {stats.expiring.slice(0, 5).map((company) => (
                <button
                  type="button"
                  key={company.id}
                  className="cc-watch-item"
                  onClick={() => onNavigate('companies')}
                >
                  <span>
                    <strong>{company.name}</strong>
                    <small>
                      Expires {formatMoaDate(company.moa_expires_at)}
                    </small>
                  </span>
                  <span className="cc-watch-days">
                    {moaDaysLeftLabel(daysUntilMoaExpiry(company.moa_expires_at!))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="cc-card cc-info-card" style={{ marginTop: 20 }}>
        <div className="cc-section-header">
          <div>
            <h2>Applications submitted</h2>
            <p>{data.academic_year && data.semester ? 'AY ' + data.academic_year + ' · Semester ' + data.semester : 'By submission month'}</p>
          </div>
        </div>

        {data.chartValues.length === 0 ? (
          <div className="cc-mini-empty">
            No submissions recorded.
          </div>
        ) : (
          <div className="cc-dashboard-chart">
            {data.chartValues.map((value, index) => {
              const max = Math.max(...data.chartValues, 1)

              return (
                <div className="cc-dashboard-chart-column" key={index}>
                  <strong>{value.toLocaleString()}</strong>
                  <div className="cc-dashboard-chart-track">
                    <span
                      style={{
                        height: `${Math.max(0, value / max) * 100}%`,
                      }}
                    />
                  </div>
                  <small>{data.chartLabels[index] ?? ''}</small>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

