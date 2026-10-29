import { useNavigate } from 'react-router-dom'

import { useCallback, useEffect, useState } from 'react'

import {
  getDeanAnalytics,
  type DeanAnalytics,
} from '../../services/deanAnalyticsService'

import { DeanCoordinatorManagement } from './DeanCoordinatorManagement'

// ========================================
// COMPLETION BAR COMPONENT
// ========================================

interface CompletionBarProps {
  value: number
  label: string
}

function CompletionBar({
  value,
  label,
}: CompletionBarProps) {
  const percent = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0

  return (
    <div className="dean-completion">
      <div className="dean-completion-label">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>

      <div
        className="dean-completion-track"
        role="img"
        aria-label={`${label}: ${percent}%`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

// ========================================
// METRIC CARD COMPONENT
// ========================================

interface MetricProps {
  label: string
  value: string | number
  note: string
}

function Metric({
  label,
  value,
  note,
}: MetricProps) {
  return (
    <article className="dean-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

// ========================================
// DEAN DASHBOARD PAGE
// ========================================

export function DeanDashboardPage() {
  const navigate = useNavigate()
  // ========================================
  // STATE
  // ========================================

  const [analytics, setAnalytics] =
    useState<DeanAnalytics | null>(null)

  const [error, setError] = useState('')

  const [isLoading, setIsLoading] = useState(true)

  const [isRefreshing, setIsRefreshing] = useState(false)

  // ========================================
  // LOAD ANALYTICS
  // ========================================

  const loadAnalytics = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setError('')

      try {
        const result = await getDeanAnalytics()
        setAnalytics(result)
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load dean analytics.'
        )
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    []
  )

  // ========================================
  // INITIAL DATA FETCH
  // ========================================

  useEffect(() => {
    let isCurrent = true

    async function fetchInitialAnalytics() {
      try {
        const result = await getDeanAnalytics()

        if (!isCurrent) return

        setAnalytics(result)
      } catch (loadError: unknown) {
        if (!isCurrent) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load dean analytics.'
        )
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void fetchInitialAnalytics()

    return () => {
      isCurrent = false
    }
  }, [])

  // ========================================
  // LOADING STATE
  // ========================================

  if (isLoading) {
    return (
      <section className="workspace-page dean-analytics">
        <p className="empty-state" role="status">
          Loading department analytics...
        </p>
      </section>
    )
  }

  // ========================================
  // ERROR STATE
  // ========================================

  if (error && !analytics) {
    return (
      <section className="workspace-page dean-analytics">
        <div className="panel dean-panel">
          <p className="form-error" role="alert">
            {error}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={() => void loadAnalytics()}
            disabled={isLoading || isRefreshing}
          >
            {isLoading ? 'Loading...' : 'Retry'}
          </button>
        </div>
      </section>
    )
  }

  // ========================================
  // EMPTY STATE
  // ========================================

  if (!analytics) {
    return (
      <section className="workspace-page dean-analytics">
        <p className="empty-state">
          No analytics are available.
        </p>

        <button
          type="button"
          className="outline-button"
          onClick={() => void loadAnalytics()}
        >
          Retry
        </button>
      </section>
    )
  }

  // ========================================
  // GENDER DISTRIBUTION
  // ========================================

  const genderRows = [
    {
      label: 'Male',
      count: analytics.gender_distribution.male,
    },
    {
      label: 'Female',
      count: analytics.gender_distribution.female,
    },
    {
      label: 'Other',
      count: analytics.gender_distribution.other,
    },
    {
      label: 'Prefer not to say',
      count:
        analytics.gender_distribution.prefer_not_to_say,
    },
    {
      label: 'Not provided',
      count:
        analytics.gender_distribution.not_provided,
    },
  ]

  // ========================================
  // RENDER DASHBOARD
  // ========================================

  return (
    <section className="workspace-page dean-analytics">

      {/* ========================================
          PAGE HEADER
      ======================================== */}

      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            CITC / ACADEMIC LEADERSHIP
          </span>

          <h1>The internship program, in perspective.</h1>

          <p>
            Aggregate progress and coordinator workload.
            Individual student records are not shown.
          </p>
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={() => void loadAnalytics(true)}
          disabled={isLoading || isRefreshing}
        >
          {isRefreshing
            ? 'Refreshing...'
            : 'Refresh Analytics'}
        </button>
      </div>

      {/* ========================================
          REFRESH ERROR
      ======================================== */}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section className="stake-dean-brief" aria-label="Program leadership brief">
        <div><span className="stake-kicker">DEAN'S BRIEF</span><h2>From student coverage<br />to program completion.</h2><p>Use aggregate outcomes to guide coordinator coverage and academic support.</p><button type="button" className="stake-yellow-button" onClick={() => navigate('/dean/direct-placements')}>Review direct placements <span aria-hidden="true">→</span></button></div>
        <div className="stake-dean-coverage"><span>Coordinator coverage</span><strong>{analytics.assigned_student_count}<small> students assigned</small></strong><div className="stake-coverage-note"><span className="stake-yellow-dot" />{analytics.unassigned_student_count} students not yet assigned</div><p>Administrators manage coordinator designations for the current internship cohort.</p></div>
      </section>

      {/* ========================================
          SUMMARY METRICS
      ======================================== */}

      <section
        className="dean-metrics"
        aria-label="Internship program metrics"
      >
        <Metric
          label="Active student accounts"
          value={analytics.enrolled_student_count}
          note="Students in the internship system"
        />

        <Metric
          label="Assigned to coordinators"
          value={analytics.assigned_student_count}
          note={
            `${analytics.unassigned_student_count} ` +
            'not yet assigned'
          }
        />

        <Metric
          label="Fully complete"
          value={`${analytics.fully_complete_percent}%`}
          note={
            `${analytics.fully_complete_students} ` +
            'assigned students'
          }
        />

        <Metric
          label="Coordinator count"
          value={analytics.coordinators.length}
          note="Active coordinators"
        />
      </section>

      {/* ========================================
          GENDER AND COMPLETENESS
      ======================================== */}

      <div className="dean-analytics-columns">

        {/* GENDER DISTRIBUTION */}

        <section className="panel dean-panel">
          <div className="panel-heading">
            <div>
              <h2>Student gender distribution</h2>

              <p>
                Optional student self-reported data;
                existing records may be unspecified.
              </p>
            </div>

            <strong className="dean-panel-total">
              {analytics.enrolled_student_count}
            </strong>
          </div>

          <div className="dean-gender-list">
            {genderRows.map((row) => {
              const percent =
                analytics.enrolled_student_count > 0
                  ? Math.round(
                      (row.count /
                        analytics.enrolled_student_count) *
                        100
                    )
                  : 0

              return (
                <div
                  className="dean-gender-row"
                  key={row.label}
                >
                  <span>{row.label}</span>

                  <div
                    className="dean-gender-track"
                    role="img"
                    aria-label={
                      `${row.label}: ${row.count} ` +
                      `students, ${percent}%`
                    }
                  >
                    <span
                      style={{
                        width: `${percent}%`,
                      }}
                    />
                  </div>

                  <strong>{row.count}</strong>
                </div>
              )
            })}
          </div>
        </section>

        {/* PROGRAM COMPLETENESS */}

        <section className="panel dean-panel">
          <div className="panel-heading">
            <div>
              <h2>Program completeness</h2>

              <p>
                Average across students assigned
                to coordinators
              </p>
            </div>
          </div>

          <div className="dean-overall-progress">
            <CompletionBar
              value={
                analytics.average_document_completion_percent
              }
              label="Required documents verified"
            />

            <CompletionBar
              value={
                analytics.average_ojt_completion_percent
              }
              label="OJT hours completed"
            />

            <CompletionBar
              value={analytics.fully_complete_percent}
              label="Students complete in both areas"
            />
          </div>
        </section>
      </div>

      {/* ========================================
          COORDINATOR ANALYTICS
      ======================================== */}

      <section className="panel dean-panel dean-coordinator-panel">
        <div className="panel-heading">
          <div>
            <h2>Coordinator analytics</h2>

            <p>
              Student counts and average completion
              for each active coordinator
            </p>
          </div>
        </div>

        {analytics.coordinators.length === 0 ? (
          <p className="empty-state">
            No active coordinators found.
          </p>
        ) : (
          <div className="dean-coordinator-grid">
            {analytics.coordinators.map(
              (coordinator) => (
                <article
                  className="dean-coordinator-card"
                  key={coordinator.coordinator_id}
                >
                  <div className="dean-coordinator-heading">
                    <div>
                      <h3>
                        {coordinator.coordinator_name}
                      </h3>

                      <span>
                        {coordinator.student_count}{' '}
                        assigned student
                        {coordinator.student_count === 1
                          ? ''
                          : 's'}
                      </span>
                    </div>

                    <strong>
                      {coordinator.fully_complete_percent}%
                    </strong>
                  </div>

                  <CompletionBar
                    value={
                      coordinator.average_document_completion_percent
                    }
                    label="Documents verified (average)"
                  />

                  <CompletionBar
                    value={
                      coordinator.average_ojt_completion_percent
                    }
                    label="OJT hours completed (average)"
                  />

                  <p className="dean-complete-note">
                    {coordinator.fully_complete_students}{' '}
                    student
                    {coordinator.fully_complete_students === 1
                      ? ''
                      : 's'}{' '}
                    fully complete in both areas
                  </p>
                </article>
              )
            )}
          </div>
        )}
      </section>

      {/* ========================================
          DEAN COORDINATOR MANAGEMENT
      ======================================== */}

      <DeanCoordinatorManagement />

      {/* ========================================
          DATA PRIVACY NOTICE
      ======================================== */}

      <p className="dean-privacy-note">
        Completeness is calculated from verified
        required documents and approved OJT hours.
        Gender details are optional, and no individual
        student identities are displayed here.
      </p>
    </section>
  )
}
