
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icons'
import {
  getCareerCompanies,
  type CareerCompany,
} from '../../services/careerCenterService'
import type { DashboardData } from '../../types/dashboard'
import './career-center-ui.css'

interface CareerDashboardPageProps {
  data: DashboardData
  name: string
  onNavigate: (section: string) => void
}

function todayString() {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function daysRemaining(date: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${todayString()}T00:00:00Z`)) /
      86400000
  )
}

export function CareerDashboardPage({
  data,
  name,
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

    const expiring = active.filter((company) => {
      if (!company.is_moa_signed || !company.moa_expires_at) {
        return false
      }

      const days = daysRemaining(company.moa_expires_at)
      return days >= 0 && days <= 30
    })

    const expired = active.filter(
      (company) =>
        company.is_moa_signed &&
        company.moa_expires_at !== null &&
        daysRemaining(company.moa_expires_at) < 0
    )

    return {
      total: active.length,
      signed: active.filter(
        (company) =>
          company.is_moa_signed &&
          (!company.moa_expires_at ||
            daysRemaining(company.moa_expires_at) > 30)
      ).length,
      pending: active.filter(
        (company) => !company.is_moa_signed
      ).length,
      expiring,
      expired: expired.length,
    }
  }, [companies])

  return (
    <main className="cc-page">
      <header className="cc-page-header">
        <div>
          <div className="cc-eyebrow">
            <span className="cc-eyebrow-dot" />
            CITC / INDUSTRY LINKAGES
          </div>

          <h1>
            Partnerships with a purpose.
          </h1>

          <p>
            Monitor internship partnerships, agreement status,
            and the latest Career Center activities.
          </p>
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
            Manage Companies
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </header>

      <section className="stake-career-brief" aria-label="Partnership agreement priorities">
        <div><span className="stake-kicker">THE INDUSTRY PARTNERSHIP DESK</span><h2>Build the bridge from<br />campus to the workplace.</h2><p>{name ? (name + ', keep') : 'Keep'} host establishments and agreements ready for the next student placement.</p><button type="button" className="stake-yellow-button" onClick={() => onNavigate('companies')}>Open partnership directory <Icon name="arrow" size={17} /></button></div>
        <div className="stake-renewal-brief"><span>Agreement watch</span><strong>{loading || error ? '—' : stats.expiring.length}<small>expiring within 30 days</small></strong><p>{loading ? 'Checking partnership records…' : error ? 'Agreement status is unavailable.' : (stats.expired + ' expired · ' + stats.pending + ' unsigned')}</p><button type="button" onClick={() => onNavigate('companies')}>Review agreements <Icon name="arrow" size={16} /></button></div>
      </section>

      {error && (
        <div className="cc-alert cc-alert-error" role="alert">
          {error}
        </div>
      )}

      <section className="cc-stats">
        {[
          ['Active Partners', stats.total, 'Registered active HTEs'],
          ['Current MOAs', stats.signed, 'No renewal due within 30 days'],
          ['Unsigned MOAs', stats.pending, 'Awaiting agreements'],
          ['Expiring Soon', stats.expiring.length, 'Within 30 days'],
          ['Expired MOAs', stats.expired, 'Need attention'],
        ].map(([label, value, detail]) => (
          <article className="cc-stat-card" key={String(label)}>
            <span className="cc-stat-label">{label}</span>
            <strong className="cc-stat-value">
              {loading || error ? '—' : value}
            </strong>
            <span className="cc-stat-detail">{detail}</span>
          </article>
        ))}
      </section>

      <section className="cc-bottom-grid stake-partnership-grid">
        <article className="cc-card cc-info-card">
          <div className="cc-section-header">
            <div>
              <span className="cc-section-kicker">RECENT UPDATES</span>
              <h2>Application Activity</h2>
              <p>Latest internship-related records.</p>
            </div>
            <button
              type="button"
              className="cc-button cc-button-secondary"
              onClick={() => onNavigate('applications')}
            >
              View All
            </button>
          </div>

          {data.activities.length === 0 ? (
            <div className="cc-mini-empty">
              No recent application activity available.
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
              <span className="cc-section-kicker">PARTNERSHIP ALERTS</span>
              <h2>MOA Monitoring</h2>
              <p>Agreements expiring within 30 days.</p>
            </div>
          </div>

          {error ? <div className="cc-mini-empty">Agreement monitoring is unavailable. Reload the page to try again.</div> : loading ? (
            <div className="cc-mini-empty">
              Loading agreements...
            </div>
          ) : stats.expiring.length === 0 ? (
            <div className="cc-mini-empty">
              No signed MOAs are currently expiring within 30 days.
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
                      MOA expiration: {company.moa_expires_at}
                    </small>
                  </span>
                  <span className="cc-watch-days">
                    {daysRemaining(company.moa_expires_at!)}d
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
            <span className="cc-section-kicker">INTERNSHIP ANALYTICS</span>
            <h2>{data.chartTitle}</h2>
            <p>{data.chartCaption}</p>
          </div>
        </div>

        {data.chartValues.length === 0 ? (
          <div className="cc-mini-empty">
            No chart data available.
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

