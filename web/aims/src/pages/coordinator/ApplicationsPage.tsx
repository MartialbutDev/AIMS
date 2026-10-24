import { useCallback, useEffect, useMemo, useState } from 'react'
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
type ReviewItem = CoordinatorReviewQueue[ReviewTab][number]
type Preview = { url: string; contentType: string; title: string }
type Decision = { kind: ReviewTab; id: string; status: string; name: string }

const EMPTY_QUEUE: CoordinatorReviewQueue = {
  applications: [], dtrs: [], journals: [],
}

const TAB_LABELS: Record<ReviewTab, string> = {
  applications: 'Applications',
  dtrs: 'Daily time records',
  journals: 'Weekly journals',
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function isPending(status: string, tab: ReviewTab) {
  if (tab === 'applications') return ['pending', 'reviewing', 'interview'].includes(status)
  if (tab === 'dtrs') return status === 'submitted'
  return ['submitted', 'reviewing'].includes(status)
}

function Status({ value }: { value: string }) {
  return <span className={`co-review-status co-review-status--${value}`}>{label(value)}</span>
}

export function ApplicationsPage() {
  const [queue, setQueue] = useState<CoordinatorReviewQueue>(EMPTY_QUEUE)
  const [tab, setTab] = useState<ReviewTab>('applications')
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const result = await getCoordinatorReviewQueue()
      setQueue(result)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the review queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  useEffect(() => {
    if (!decision && !preview) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setDecision(null)
        setPreview(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [decision, preview, busy])

  const counts = useMemo(() => ({
    applications: queue.applications.filter((item) => isPending(item.status, 'applications')).length,
    dtrs: queue.dtrs.filter((item) => isPending(item.status, 'dtrs')).length,
    journals: queue.journals.filter((item) => isPending(item.status, 'journals')).length,
  }), [queue])

  const records = useMemo(() => {
    const query = search.trim().toLowerCase()
    return queue[tab].filter((item) => {
      const searchable = JSON.stringify(item).toLowerCase()
      if (query && !searchable.includes(query)) return false
      const pending = isPending(item.status, tab)
      return filter === 'all' || (filter === 'pending' ? pending : !pending)
    })
  }, [queue, tab, filter, search])

  function requestDecision(kind: ReviewTab, item: ReviewItem, status: string) {
    setDecision({ kind, id: item.id, status, name: item.student_name })
    setError('')
    setNotice('')
  }

  async function confirmDecision() {
    if (!decision || busy) return
    const { kind, id, status } = decision
    setBusy(id)
    setError('')
    setNotice('')
    try {
      if (kind === 'applications') {
        await reviewCoordinatorApplication(id, status as ApplicationReviewStatus)
      } else if (kind === 'dtrs') {
        await reviewCoordinatorDtr(id, status as RecordReviewStatus)
      } else {
        await reviewCoordinatorJournal(id, status as RecordReviewStatus)
      }
      setDecision(null)
      setNotice(`${label(kind.slice(0, -1))} updated to ${label(status)}. Refreshing records…`)
      await refresh(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the review.')
      setDecision(null)
    } finally {
      setBusy('')
    }
  }

  async function openPreview(studentId: string, id: string, kind: 'journal' | 'in' | 'out', title: string) {
    if (busy) return
    setBusy(id)
    setError('')
    try {
      const file = kind === 'journal'
        ? await getCoordinatorJournalFile(studentId, id)
        : await getCoordinatorStudentFile(studentId, `dtr/${encodeURIComponent(id)}/photo/${kind}`)
      setPreview({ ...file, title })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open this file.')
    } finally {
      setBusy('')
    }
  }

  const totalPending = counts.applications + counts.dtrs + counts.journals

  return (
    <main className="co-page co-review-page">
      <header className="co-review-header">
        <div>
          <span className="co-overline">COORDINATOR WORKSPACE · REVIEW CENTER</span>
          <h1>Internship review center</h1>
          <p>Review applications, verify daily time records, and assess weekly journals for your assigned students.</p>
          {lastUpdated && <span className="co-review-updated">Last refreshed {lastUpdated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>}
        </div>
        <button className="co-button co-button-outline" type="button" onClick={() => void refresh()} disabled={loading || !!busy}>
          <Icon name="arrow" size={16} /> {loading ? 'Refreshing…' : 'Refresh records'}
        </button>
      </header>

      {error && <div className="co-review-alert co-review-alert--error" role="alert">{error}</div>}
      {notice && <div className="co-review-alert co-review-alert--success" role="status">{notice}</div>}

      <div className="co-review-summary" aria-label="Review overview">
        <div className="co-review-summary-total"><small>Total awaiting review</small><strong>{totalPending}</strong><span>Across all review categories</span></div>
        <div><small>Applications awaiting decision</small><strong>{counts.applications}</strong><span>{queue.applications.length} records loaded</span></div>
        <div><small>Submitted DTRs</small><strong>{counts.dtrs}</strong><span>{queue.dtrs.length} records loaded</span></div>
        <div><small>Journals awaiting review</small><strong>{counts.journals}</strong><span>{queue.journals.length} records loaded</span></div>
      </div>

      <section className="co-review-panel" aria-label="Student review records">
        <div className="co-review-toolbar">
          <div className="co-review-tabs" role="group" aria-label="Review category">
            {(['applications', 'dtrs', 'journals'] as const).map((value) => (
              <button key={value} type="button" className={tab === value ? 'is-active' : ''} aria-pressed={tab === value}
                onClick={() => { setTab(value); setFilter('pending'); setExpandedId(null) }}>
                {TAB_LABELS[value]} <span>{counts[value]}</span>
              </button>
            ))}
          </div>
          <div className="co-review-filters">
            <label className="co-review-search">
              <Icon name="search" size={16} />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student, company, or record…" aria-label="Search review records" />
            </label>
            <select aria-label="Filter review status" value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilter)}>
              <option value="pending">Awaiting review</option>
              <option value="completed">Completed / other</option>
              <option value="all">All records</option>
            </select>
          </div>
          <div className="co-review-result-count" aria-live="polite">Showing {records.length} of {queue[tab].length} loaded {TAB_LABELS[tab].toLowerCase()}</div>
        </div>

        {loading ? (
          <div className="co-review-empty" role="status">Loading assigned student records…</div>
        ) : records.length === 0 ? (
          <div className="co-review-empty"><strong>No matching records</strong><p>{search ? 'Try another search term or status filter.' : filter === 'pending' ? 'No records are awaiting review in this category.' : 'No records match the selected filter.'}</p></div>
        ) : (
          <div className="co-review-records">
            {tab === 'applications' && queue.applications.filter((item) => records.some((record) => record.id === item.id)).map((item) => (
              <article key={item.id} className="co-review-record">
                <div className="co-review-record-main">
                  <div className="co-review-record-top"><strong>{item.student_name}</strong><Status value={item.status} /></div>
                  <p>{item.position} · {item.company_name || 'Company not specified'}</p>
                  <small>Applied {formatDate(item.applied_date)}</small>
                  {expandedId === item.id && <div className="co-review-details"><span>Student ID: {item.student_id}</span><span>Application ID: {item.id}</span><span>Current status: {label(item.status)}</span></div>}
                </div>
                <div className="co-review-actions">
                  <button type="button" disabled={!!busy} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{expandedId === item.id ? 'Less details' : 'Details'}</button>
                  {isPending(item.status, 'applications') && <>
                    {item.status === 'pending' && <button type="button" disabled={!!busy} onClick={() => requestDecision('applications', item, 'reviewing')}>Reviewing</button>}
                    {item.status !== 'interview' && <button type="button" disabled={!!busy} onClick={() => requestDecision('applications', item, 'interview')}>Interview</button>}
                    <button type="button" className="co-review-approve" disabled={!!busy} onClick={() => requestDecision('applications', item, 'accepted')}>Accept</button>
                    <button type="button" className="co-review-reject" disabled={!!busy} onClick={() => requestDecision('applications', item, 'rejected')}>Reject</button>
                  </>}
                </div>
              </article>
            ))}

            {tab === 'dtrs' && queue.dtrs.filter((item) => records.some((record) => record.id === item.id)).map((item) => (
              <article key={item.id} className="co-review-record">
                <div className="co-review-record-main">
                  <div className="co-review-record-top"><strong>{item.student_name}</strong><Status value={item.status} /></div>
                  <p>{formatDate(item.date)} · {item.time_in} – {item.time_out || 'No time-out'} · {item.total_hours ?? 0} hours</p>
                  {item.tasks_completed && <small>{item.tasks_completed}</small>}
                  {expandedId === item.id && <div className="co-review-details"><span>Student ID: {item.student_id}</span><span>DTR ID: {item.id}</span><span>{item.time_out ? 'Time-out recorded' : 'Time-out not recorded'}</span></div>}
                </div>
                <div className="co-review-actions">
                  <button type="button" disabled={!!busy} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{expandedId === item.id ? 'Less details' : 'Details'}</button>
                  {item.image_in_available && <button type="button" disabled={!!busy} onClick={() => void openPreview(item.student_id, item.id, 'in', 'DTR time-in photo')}>Time-in photo</button>}
                  {item.image_out_available && <button type="button" disabled={!!busy} onClick={() => void openPreview(item.student_id, item.id, 'out', 'DTR time-out photo')}>Time-out photo</button>}
                  {item.status === 'submitted' && item.time_out && <>
                    <button type="button" className="co-review-approve" disabled={!!busy} onClick={() => requestDecision('dtrs', item, 'approved')}>Approve</button>
                    <button type="button" className="co-review-reject" disabled={!!busy} onClick={() => requestDecision('dtrs', item, 'rejected')}>Reject</button>
                  </>}
                  {item.status === 'submitted' && !item.time_out && <span className="co-review-hint">Waiting for time-out</span>}
                </div>
              </article>
            ))}

            {tab === 'journals' && queue.journals.filter((item) => records.some((record) => record.id === item.id)).map((item) => (
              <article key={item.id} className="co-review-record">
                <div className="co-review-record-main">
                  <div className="co-review-record-top"><strong>{item.student_name}</strong><Status value={item.status} /></div>
                  <p>Week {item.week} · {item.title}</p>
                  {item.summary && <small>{item.summary}</small>}
                  {expandedId === item.id && <div className="co-review-details"><span>Student ID: {item.student_id}</span><span>Journal ID: {item.id}</span><span>Status: {label(item.status)}</span></div>}
                </div>
                <div className="co-review-actions">
                  <button type="button" disabled={!!busy} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{expandedId === item.id ? 'Less details' : 'Details'}</button>
                  <button type="button" disabled={!!busy} onClick={() => void openPreview(item.student_id, item.id, 'journal', `Week ${item.week} journal`)}>View file</button>
                  {isPending(item.status, 'journals') && <>
                    <button type="button" className="co-review-approve" disabled={!!busy} onClick={() => requestDecision('journals', item, 'approved')}>Approve</button>
                    <button type="button" className="co-review-reject" disabled={!!busy} onClick={() => requestDecision('journals', item, 'rejected')}>Reject</button>
                  </>}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="co-review-footnote">Up to 200 recent records are requested per category. Results may not include every record. Access and semester restrictions must be enforced by the backend.</div>
      </section>

      {decision && <div className="co-review-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDecision(null) }}>
        <section className="co-review-confirm" role="alertdialog" aria-modal="true" aria-labelledby="co-review-confirm-title" aria-describedby="co-review-confirm-description">
          <span className="co-overline">CONFIRM REVIEW ACTION</span>
          <h2 id="co-review-confirm-title">{label(decision.status)} {decision.kind === 'applications' ? 'application' : decision.kind === 'dtrs' ? 'DTR' : 'journal'}?</h2>
          <p id="co-review-confirm-description">This will update the record for <strong>{decision.name}</strong> to <strong>{label(decision.status)}</strong>. Please verify the supporting records before continuing.</p>
          <div className="co-review-confirm-actions">
            <button type="button" className="co-button co-button-outline" disabled={!!busy} onClick={() => setDecision(null)}>Cancel</button>
            <button type="button" className={`co-button ${decision.status === 'rejected' ? 'co-review-confirm-danger' : 'co-button-primary'}`} disabled={!!busy} onClick={() => void confirmDecision()}>{busy ? 'Saving…' : `Confirm ${label(decision.status)}`}</button>
          </div>
        </section>
      </div>}

      {preview && <div className="co-review-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null) }}>
        <section className="co-review-preview" role="dialog" aria-modal="true" aria-label={preview.title}>
          <header><strong>{preview.title}</strong><button type="button" onClick={() => setPreview(null)} aria-label="Close preview">×</button></header>
          {preview.contentType === 'application/pdf' ? <iframe title={preview.title} src={preview.url} /> : preview.contentType.startsWith('image/') ? <img src={preview.url} alt={preview.title} /> : <p className="co-review-preview-unsupported">Preview is unavailable for this file format.</p>}
        </section>
      </div>}
    </main>
  )
}
