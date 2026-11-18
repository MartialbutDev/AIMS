import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  listAttendanceAbsences, requestAttendanceAbsence, reviewAttendanceAbsence, type AttendanceAbsence,
} from '../../services/attendanceAbsenceService'
import './attendance-absences.css'

const statusLabels = { pending: 'Pending supervisor review', approved: 'Approved', declined: 'Declined' }

type Props =
  | { role: 'student'; active: boolean }
  | { role: 'company'; id: string; active: boolean }
  | { role: 'coordinator'; id: string }

export function AttendanceAbsences(props: Props) {
  const scope = props.role === 'student' ? 'mine' : `${props.role}/${encodeURIComponent(props.id)}`
  const [items, setItems] = useState<AttendanceAbsence[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const pending = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    setItems(null)
    setFeedback(null)
    listAttendanceAbsences(scope, controller.signal).then(result => {
      if (!controller.signal.aborted) setItems(result)
    }).catch(() => {
      if (!controller.signal.aborted) setFeedback({ error: true, text: 'Could not load absence requests.' })
    })
    return () => controller.abort()
  }, [scope, revision])

  async function update(action: () => Promise<AttendanceAbsence>, message: string) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const saved = await action()
      setItems(current => [saved, ...(current ?? []).filter(item => item.id !== saved.id)]
        .sort((a, b) => b.workday.localeCompare(a.workday)))
      setEditing(false)
      setFeedback({ error: false, text: message })
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : 'Could not save the absence request.' })
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const kind = fields.get('kind')
    if (kind !== 'planned' && kind !== 'emergency') {
      setFeedback({ error: true, text: 'Select an absence type.' })
      return
    }
    void update(() => requestAttendanceAbsence({
      workday: String(fields.get('workday')),
      kind,
      reason: String(fields.get('reason')).trim(),
    }), 'Absence request sent to your company supervisor.')
  }

  return <section className="attendance-absences" aria-label="Absence requests">
    <div className="attendance-absence-heading">
      <h2>Absence requests</h2>
      {props.role === 'student' && props.active && items && !editing &&
        <button type="button" className="primary-button" onClick={() => setEditing(true)}>Request absence</button>}
    </div>
    {editing && <form className="attendance-absence-form" onSubmit={submit} aria-label="Request absence">
      <p>Use Emergency absence for illness or a missed shift you could not report earlier.</p>
      <div className="attendance-absence-fields">
        <label>Absence type<select name="kind" defaultValue="" required disabled={busy}><option value="" disabled>Select absence type</option><option value="planned">Planned absence</option><option value="emergency">Emergency absence</option></select></label>
        <label>Date<input name="workday" type="date" required disabled={busy} /></label>
      </div>
      <label>Brief reason<textarea name="reason" rows={3} minLength={3} maxLength={300} required disabled={busy} /></label>
      <div className="attendance-absence-actions">
        <button className="primary-button" disabled={busy}>Send request</button>
        <button type="button" onClick={() => { setEditing(false); setFeedback(null) }} disabled={busy}>Cancel</button>
      </div>
    </form>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    {!items && (feedback ? <button type="button" onClick={() => setRevision(value => value + 1)}>Retry absence requests</button> : <p role="status">Loading absence requests…</p>)}
    {items?.length === 0 && !editing && <p>No absence requests yet.</p>}
    {items && items.length > 0 && <ul>
      {items.map(item => <li key={item.id}>
        <div className="attendance-absence-heading">
          <strong><time dateTime={item.workday}>{item.workday}</time> · {item.kind === 'planned' ? 'Planned absence' : 'Emergency absence'}</strong>
          <span className={`attendance-absence-status is-${item.status}`}>{statusLabels[item.status]}</span>
        </div>
        <p>{item.reason}</p>
        {props.role === 'company' && props.active && item.status === 'pending' && <div className="attendance-absence-actions">
          <button type="button" className="stake-navy-button" disabled={busy} onClick={() => void update(() => reviewAttendanceAbsence(scope, item.id, 'approved'), 'Absence approved.')}>Approve</button>
          <button type="button" disabled={busy} onClick={() => void update(() => reviewAttendanceAbsence(scope, item.id, 'declined'), 'Absence declined.')}>Decline</button>
        </div>}
      </li>)}
    </ul>}
  </section>
}
