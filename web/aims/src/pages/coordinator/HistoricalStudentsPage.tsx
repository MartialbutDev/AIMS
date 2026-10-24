
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icons'
import {
  getCoordinatorHistoricalStudents,
  type HistoricalCoordinatorStudent,
} from '../../services/coordinatorService'
import './coordinator-history.css'

interface HistoricalStudentsPageProps {
  onNavigate: (section: string) => void
}

export function HistoricalStudentsPage({
  onNavigate,
}: HistoricalStudentsPageProps) {
  const [items, setItems] = useState<HistoricalCoordinatorStudent[]>([])
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    setLoading(true)
    setError('')

    getCoordinatorHistoricalStudents()
      .then((result) => {
        if (active) setItems(result.items)
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load historical assignments.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [refreshKey])

  const terms = useMemo(
    () =>
      Array.from(
        new Set(
          items.map(
            (item) => `${item.academic_year}|${item.semester}`,
          ),
        ),
      )
        .sort()
        .reverse(),
    [items],
  )

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchesTerm =
          term === 'all' ||
          `${item.academic_year}|${item.semester}` === term

        const q = search.trim().toLowerCase()

        const matchesSearch =
          !q ||
          [
            item.first_name,
            item.last_name,
            item.email,
            item.student_number ?? '',
          ].some((field) => field.toLowerCase().includes(q))

        return matchesTerm && matchesSearch
      }),
    [items, term, search],
  )

  return (
    <section className="workspace-page coordinator-workspace">
      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            COORDINATOR WORKSPACE
          </span>
          <h1>Historical students</h1>
          <p>
            Review your previous-semester student assignments.
            These assignments are read-only.
          </p>
        </div>
        <span className="coordinator-student-count">
          {items.length} assignments
        </span>
      </div>

      <div className="panel co-history-panel">
        <div className="co-history-toolbar">
          <label className="coordinator-search">
            <Icon name="search" size={16} />
            <input
              aria-label="Search historical students"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or student ID"
            />
          </label>

          <label className="co-history-term">
            Academic term
            <select
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            >
              <option value="all">All previous semesters</option>
              {terms.map((value) => {
                const [year, semester] = value.split('|')

                return (
                  <option key={value} value={value}>
                    {year} · Semester {semester}
                  </option>
                )
              })}
            </select>
          </label>

          <button
            type="button"
            className="document-file-button"
            onClick={() => setRefreshKey((n) => n + 1)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <p className="co-history-notice" role="note">
          Historical assignment metadata is available here.
          Internship documents, DTRs, journals, and evaluations
          are not displayed until the backend supports verified
          academic-term filtering for each record.
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="empty-state">
            Loading historical assignments…
          </p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">
            No historical assignments match your filters.
          </p>
        ) : (
          <div className="co-history-list">
            {filtered.map((student) => (
              <article
                className="co-history-row"
                key={student.assignment_id}
              >
                <span className="student-profile-avatar">
                  {student.first_name.slice(0, 1)}
                  {student.last_name.slice(0, 1)}
                </span>

                <div className="co-history-person">
                  <strong>
                    {student.first_name} {student.last_name}
                  </strong>
                  <span>
                    {student.student_number || 'No student ID'}
                    {' · '}
                    {student.email}
                  </span>
                </div>

                <div className="co-history-meta">
                  <span>
                    {student.academic_year} · Semester{' '}
                    {student.semester}
                  </span>
                  <strong className="co-history-readonly">
                    Read-only
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="document-file-button"
        onClick={() => onNavigate('students')}
      >
        Back to current students
      </button>
    </section>
  )
}
