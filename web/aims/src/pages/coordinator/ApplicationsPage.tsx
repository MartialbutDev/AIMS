
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Icon } from '../../components/Icons'

import {
  getCoordinatorReviewQueue,
  getCoordinatorStudentFile,
  getCoordinatorJournalFile,
  reviewCoordinatorApplication,
  reviewCoordinatorDtr,
  reviewCoordinatorJournal,
  type ApplicationReviewStatus,
  type CoordinatorReviewQueue,
  type RecordReviewStatus,
} from '../../services/coordinatorService'

import './coordinator-review.css'

type ReviewTab = 'applications' | 'dtrs' | 'journals'
type ReviewFilter = 'all' | 'pending' | 'completed'

type Preview = {
  url: string
  contentType: string
  title: string
}

const EMPTY_QUEUE: CoordinatorReviewQueue = {
  applications: [],
  dtrs: [],
  journals: [],
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) return 'Not recorded'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
      }).format(date)
}

function isPending(
  status: string,
  tab: ReviewTab,
): boolean {
  if (tab === 'applications') {
    return [
      'pending',
      'reviewing',
      'interview',
    ].includes(status)
  }

  if (tab === 'dtrs') {
    return status === 'submitted'
  }

  return [
    'submitted',
    'reviewing',
  ].includes(status)
}

function Status({
  value,
}: {
  value: string
}) {
  return (
    <span
      className={`co-review-status co-review-status--${value}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  )
}

export function ApplicationsPage() {
  const [queue, setQueue] =
    useState<CoordinatorReviewQueue>(EMPTY_QUEUE)

  const [tab, setTab] =
    useState<ReviewTab>('applications')

  const [filter, setFilter] =
    useState<ReviewFilter>('pending')

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [preview, setPreview] =
    useState<Preview | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setQueue(await getCoordinatorReviewQueue())
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load the review queue.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [preview])

  const counts = {
    applications: queue.applications.filter(
      (item) => isPending(item.status, 'applications'),
    ).length,

    dtrs: queue.dtrs.filter(
      (item) => isPending(item.status, 'dtrs'),
    ).length,

    journals: queue.journals.filter(
      (item) => isPending(item.status, 'journals'),
    ).length,
  }

  const records = useMemo(() => {
    const query = search.trim().toLowerCase()
    const items = queue[tab]

    return items.filter((item) => {
      const text = JSON.stringify(item).toLowerCase()

      if (query && !text.includes(query)) {
        return false
      }

      const pending = isPending(item.status, tab)

      return (
        filter === 'all' ||
        (filter === 'pending' ? pending : !pending)
      )
    })
  }, [queue, tab, filter, search])

  async function updateStatus(
    kind: ReviewTab,
    id: string,
    status: string,
  ) {
    const action =
      status === 'rejected'
        ? 'reject'
        : `mark as ${status}`

    const recordType =
      kind === 'dtrs'
        ? 'DTR'
        : kind === 'journals'
          ? 'journal'
          : 'application'

    if (
      !window.confirm(
        `Are you sure you want to ${action} this ${recordType}?`,
      )
    ) {
      return
    }

    setBusy(id)
    setError('')
    setNotice('')

    try {
      if (kind === 'applications') {
        await reviewCoordinatorApplication(
          id,
          status as ApplicationReviewStatus,
        )
      } else if (kind === 'dtrs') {
        await reviewCoordinatorDtr(
          id,
          status as RecordReviewStatus,
        )
      } else {
        await reviewCoordinatorJournal(
          id,
          status as RecordReviewStatus,
        )
      }

      setNotice(
        'Review saved successfully. The student notification has been requested.',
      )

      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save the review.',
      )
    } finally {
      setBusy('')
    }
  }

  async function openPreview(
    studentId: string,
    id: string,
    kind: 'journal' | 'in' | 'out',
    title: string,
  ) {
    setBusy(id)
    setError('')

    try {
      const file =
        kind === 'journal'
          ? await getCoordinatorJournalFile(studentId, id)
          : await getCoordinatorStudentFile(
              studentId,
              `dtr/${id}/photo/${kind}`,
            )

      setPreview({
        ...file,
        title,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open this file.',
      )
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="co-page co-review-page">
      <header className="co-review-header">
        <div>
          <span className="co-overline">
            COORDINATOR · ASSIGNED STUDENTS ONLY
          </span>

          <h1>Internship review center</h1>

          <p>
            Review student applications, completed daily
            time records, and weekly journals.
          </p>
        </div>

        <button
          className="co-button co-button-outline"
          type="button"
          onClick={() => void refresh()}
          disabled={loading || !!busy}
        >
          <Icon name="arrow" size={16} />
          {loading ? 'Refreshing…' : 'Refresh records'}
        </button>
      </header>

      {error && (
        <div
          className="co-review-alert co-review-alert--error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="co-review-alert co-review-alert--success"
          role="status"
        >
          {notice}
        </div>
      )}

      <div
        className="co-review-summary"
        aria-label="Items awaiting review"
      >
        <div>
          <small>Applications awaiting decision</small>
          <strong>{counts.applications}</strong>
        </div>

        <div>
          <small>Submitted DTRs</small>
          <strong>{counts.dtrs}</strong>
        </div>

        <div>
          <small>Submitted journals</small>
          <strong>{counts.journals}</strong>
        </div>
      </div>

      <section className="co-review-panel">
        <div className="co-review-toolbar">
          <div
            className="co-review-tabs"
            role="group"
            aria-label="Review category"
          >
            {(
              [
                ['applications', 'Applications'],
                ['dtrs', 'DTR monitoring'],
                ['journals', 'Weekly journals'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  tab === value ? 'is-active' : ''
                }
                aria-pressed={tab === value}
                onClick={() => {
                  setTab(value)
                  setFilter('pending')
                }}
              >
                {label}
                <span>{counts[value]}</span>
              </button>
            ))}
          </div>

          <div className="co-review-filters">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search student, company, or record…"
              aria-label="Search review records"
            />

            <select
              aria-label="Filter review status"
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value as ReviewFilter,
                )
              }
            >
              <option value="pending">
                Awaiting review
              </option>

              <option value="completed">
                Completed / other
              </option>

              <option value="all">
                All records
              </option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="co-review-empty">
            Loading assigned student records…
          </div>
        ) : records.length === 0 ? (
          <div className="co-review-empty">
            No matching {tab} found.
          </div>
        ) : (
          <div className="co-review-records">
            {tab === 'applications' &&
              queue.applications
                .filter((item) =>
                  records.some(
                    (record) => record.id === item.id,
                  ),
                )
                .map((item) => (
                  <article
                    key={item.id}
                    className="co-review-record"
                  >
                    <div className="co-review-record-main">
                      <div className="co-review-record-top">
                        <strong>
                          {item.student_name}
                        </strong>

                        <Status value={item.status} />
                      </div>

                      <p>
                        {item.position} ·{' '}
                        {item.company_name ||
                          'Company not specified'}
                      </p>

                      <small>
                        Applied {formatDate(item.applied_date)}
                      </small>
                    </div>

                    {isPending(
                      item.status,
                      'applications',
                    ) && (
                      <div className="co-review-actions">
                        {item.status === 'pending' && (
                          <button
                            disabled={!!busy}
                            onClick={() =>
                              void updateStatus(
                                'applications',
                                item.id,
                                'reviewing',
                              )
                            }
                          >
                            Reviewing
                          </button>
                        )}

                        {item.status !== 'interview' && (
                          <button
                            disabled={!!busy}
                            onClick={() =>
                              void updateStatus(
                                'applications',
                                item.id,
                                'interview',
                              )
                            }
                          >
                            Interview
                          </button>
                        )}

                        <button
                          className="co-review-approve"
                          disabled={!!busy}
                          onClick={() =>
                            void updateStatus(
                              'applications',
                              item.id,
                              'accepted',
                            )
                          }
                        >
                          Accept
                        </button>

                        <button
                          className="co-review-reject"
                          disabled={!!busy}
                          onClick={() =>
                            void updateStatus(
                              'applications',
                              item.id,
                              'rejected',
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))}

            {tab === 'dtrs' &&
              queue.dtrs
                .filter((item) =>
                  records.some(
                    (record) => record.id === item.id,
                  ),
                )
                .map((item) => (
                  <article
                    key={item.id}
                    className="co-review-record"
                  >
                    <div className="co-review-record-main">
                      <div className="co-review-record-top">
                        <strong>
                          {item.student_name}
                        </strong>

                        <Status value={item.status} />
                      </div>

                      <p>
                        {formatDate(item.date)} ·{' '}
                        {item.time_in} –{' '}
                        {item.time_out || 'No time-out'} ·{' '}
                        {item.total_hours ?? 0} hours
                      </p>

                      {item.tasks_completed && (
                        <small>
                          {item.tasks_completed}
                        </small>
                      )}
                    </div>

                    <div className="co-review-actions">
                      {item.image_in_available && (
                        <button
                          disabled={!!busy}
                          onClick={() =>
                            void openPreview(
                              item.student_id,
                              item.id,
                              'in',
                              'DTR time-in photo',
                            )
                          }
                        >
                          Time-in photo
                        </button>
                      )}

                      {item.image_out_available && (
                        <button
                          disabled={!!busy}
                          onClick={() =>
                            void openPreview(
                              item.student_id,
                              item.id,
                              'out',
                              'DTR time-out photo',
                            )
                          }
                        >
                          Time-out photo
                        </button>
                      )}

                      {item.status === 'submitted' &&
                        item.time_out && (
                          <>
                            <button
                              className="co-review-approve"
                              disabled={!!busy}
                              onClick={() =>
                                void updateStatus(
                                  'dtrs',
                                  item.id,
                                  'approved',
                                )
                              }
                            >
                              Approve
                            </button>

                            <button
                              className="co-review-reject"
                              disabled={!!busy}
                              onClick={() =>
                                void updateStatus(
                                  'dtrs',
                                  item.id,
                                  'rejected',
                                )
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}
                    </div>
                  </article>
                ))}

            {tab === 'journals' &&
              queue.journals
                .filter((item) =>
                  records.some(
                    (record) => record.id === item.id,
                  ),
                )
                .map((item) => (
                  <article
                    key={item.id}
                    className="co-review-record"
                  >
                    <div className="co-review-record-main">
                      <div className="co-review-record-top">
                        <strong>
                          {item.student_name}
                        </strong>

                        <Status value={item.status} />
                      </div>

                      <p>
                        Week {item.week} · {item.title}
                      </p>

                      {item.summary && (
                        <small>
                          {item.summary}
                        </small>
                      )}
                    </div>

                    <div className="co-review-actions">
                      <button
                        disabled={!!busy}
                        onClick={() =>
                          void openPreview(
                            item.student_id,
                            item.id,
                            'journal',
                            `Week ${item.week} journal`,
                          )
                        }
                      >
                        View PDF
                      </button>

                      {isPending(
                        item.status,
                        'journals',
                      ) && (
                        <>
                          <button
                            className="co-review-approve"
                            disabled={!!busy}
                            onClick={() =>
                              void updateStatus(
                                'journals',
                                item.id,
                                'approved',
                              )
                            }
                          >
                            Approve
                          </button>

                          <button
                            className="co-review-reject"
                            disabled={!!busy}
                            onClick={() =>
                              void updateStatus(
                                'journals',
                                item.id,
                                'rejected',
                              )
                            }
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
          </div>
        )}

        <div className="co-review-footnote">
          Showing up to 200 recent records per category.
          Review actions are restricted to your assigned
          students.
        </div>
      </section>

      {preview && (
        <div
          className="co-review-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreview(null)
            }
          }}
        >
          <section
            className="co-review-preview"
            role="dialog"
            aria-modal="true"
            aria-label={preview.title}
          >
            <header>
              <strong>{preview.title}</strong>

              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
              >
                ×
              </button>
            </header>

            {preview.contentType === 'application/pdf' ? (
              <iframe
                title={preview.title}
                src={preview.url}
              />
            ) : preview.contentType.startsWith(
                'image/',
              ) ? (
              <img
                src={preview.url}
                alt={preview.title}
              />
            ) : (
              <p>
                Preview is unavailable for this file format.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
