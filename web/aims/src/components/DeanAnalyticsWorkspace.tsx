import { useEffect, useState } from 'react'
import { getDeanAnalytics, type DeanAnalytics } from '../services/deanAnalyticsService'

function CompletionBar({ value, label }: { value: number; label: string }) {
  const percent = Math.min(100, Math.max(0, value))
  return (
    <div className="dean-completion">
      <div className="dean-completion-label"><span>{label}</span><strong>{percent}%</strong></div>
      <div className="dean-completion-track" role="img" aria-label={`${label}: ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  note,
}: {
  label: string
  value: string | number
  note: string
}) {
  return (
    <article className="dean-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

export function DeanAnalyticsWorkspace() {
  const [analytics, setAnalytics] = useState<DeanAnalytics | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCurrent = true
    getDeanAnalytics()
      .then((result) => { if (isCurrent) setAnalytics(result) })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not load dean analytics.')
      })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  if (isLoading) return <p className="empty-state">Loading department analytics…</p>
  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!analytics) return <p className="empty-state">No analytics are available.</p>

  const genderRows = [
    { label: 'Male', count: analytics.gender_distribution.male },
    { label: 'Female', count: analytics.gender_distribution.female },
    { label: 'Other', count: analytics.gender_distribution.other },
    { label: 'Prefer not to say', count: analytics.gender_distribution.prefer_not_to_say },
    { label: 'Not provided', count: analytics.gender_distribution.not_provided },
  ]

  return (
    <section className="workspace-page dean-analytics">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow"><span className="eyebrow-dot" /> DEPARTMENT ANALYTICS</span>
          <h1>Internship program overview</h1>
          <p>Aggregate progress and coordinator workload. Individual student records are not shown.</p>
        </div>
      </div>

      <section className="dean-metrics" aria-label="Internship program metrics">
        <Metric label="Active student accounts" value={analytics.enrolled_student_count} note="Students in the internship system" />
        <Metric label="Assigned to coordinators" value={analytics.assigned_student_count} note={`${analytics.unassigned_student_count} not yet assigned`} />
        <Metric label="Fully complete" value={`${analytics.fully_complete_percent}%`} note={`${analytics.fully_complete_students} assigned students`} />
        <Metric label="Coordinator count" value={analytics.coordinators.length} note="Active coordinators" />
      </section>

      <div className="dean-analytics-columns">
        <section className="panel dean-panel">
          <div className="panel-heading">
            <div><h2>Student gender distribution</h2><p>Optional student self-reported data; existing records may be unspecified.</p></div>
            <strong className="dean-panel-total">{analytics.enrolled_student_count}</strong>
          </div>
          <div className="dean-gender-list">
            {genderRows.map((row) => {
              const percent = analytics.enrolled_student_count
                ? Math.round(row.count / analytics.enrolled_student_count * 100)
                : 0
              return (
                <div className="dean-gender-row" key={row.label}>
                  <span>{row.label}</span>
                  <div className="dean-gender-track" role="img" aria-label={`${row.label}: ${row.count} students, ${percent}%`}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel dean-panel">
          <div className="panel-heading"><div><h2>Program completeness</h2><p>Average across students assigned to coordinators</p></div></div>
          <div className="dean-overall-progress">
            <CompletionBar value={analytics.average_document_completion_percent} label="Required documents verified" />
            <CompletionBar value={analytics.average_ojt_completion_percent} label="OJT hours completed" />
            <CompletionBar value={analytics.fully_complete_percent} label="Students complete in both areas" />
          </div>
        </section>
      </div>

      <section className="panel dean-panel dean-coordinator-panel">
        <div className="panel-heading"><div><h2>Coordinator analytics</h2><p>Student counts and average completion for each active coordinator</p></div></div>
        {analytics.coordinators.length === 0 ? (
          <p className="empty-state">No active coordinators found.</p>
        ) : (
          <div className="dean-coordinator-grid">
            {analytics.coordinators.map((coordinator) => (
              <article className="dean-coordinator-card" key={coordinator.coordinator_id}>
                <div className="dean-coordinator-heading">
                  <div><h3>{coordinator.coordinator_name}</h3><span>{coordinator.student_count} assigned student{coordinator.student_count === 1 ? '' : 's'}</span></div>
                  <strong>{coordinator.fully_complete_percent}%</strong>
                </div>
                <CompletionBar value={coordinator.average_document_completion_percent} label="Documents verified (average)" />
                <CompletionBar value={coordinator.average_ojt_completion_percent} label="OJT hours completed (average)" />
                <p className="dean-complete-note">{coordinator.fully_complete_students} student{coordinator.fully_complete_students === 1 ? '' : 's'} fully complete in both areas</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="dean-privacy-note">Completeness is calculated from verified required documents and approved OJT hours. Gender details are optional, and no individual student identities are displayed here.</p>
    </section>
  )
}
