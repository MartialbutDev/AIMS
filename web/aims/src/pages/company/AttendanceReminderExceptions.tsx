import { useRef, useState, type FormEvent } from 'react'
import {
  removeCompanyAttendanceException, saveCompanyAttendanceException,
  type AttendanceExceptionKind, type AttendanceScheduleException,
} from '../../services/companyMonitoringService'

const labels: Record<AttendanceExceptionKind, string> = {
  holiday: 'Holiday',
  approved_absence: 'Approved absence',
  shift_change: 'Shift change',
}

export function AttendanceReminderExceptions({
  deploymentId, initialExceptions,
}: { deploymentId: string; initialExceptions: AttendanceScheduleException[] }) {
  const [entries, setEntries] = useState(initialExceptions)
  const [workday, setWorkday] = useState('')
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState<AttendanceExceptionKind>('holiday')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const updating = useRef(false)
  const kindInput = useRef<HTMLSelectElement>(null)

  function select(entry?: AttendanceScheduleException) {
    setEditing(Boolean(entry))
    setWorkday(entry?.workday ?? '')
    setKind(entry?.kind ?? 'holiday')
    setClockIn(entry?.clock_in_at?.slice(0, 5) ?? '')
    setClockOut(entry?.clock_out_at?.slice(0, 5) ?? '')
  }

  async function update(action: () => Promise<void>, success: string) {
    if (updating.current) return
    updating.current = true
    setBusy(true)
    setFeedback(null)
    try {
      await action()
      setFeedback({ error: false, text: success })
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : 'Could not update the schedule exception.' })
    } finally {
      updating.current = false
      setBusy(false)
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const isShift = kind === 'shift_change'
    if (isShift && clockOut <= clockIn) {
      setFeedback({ error: true, text: 'Clock-out must be later than clock-in on the same day.' })
      return
    }
    void update(async () => {
      const saved = await saveCompanyAttendanceException(deploymentId, workday, {
        kind, clock_in_at: isShift ? clockIn : null, clock_out_at: isShift ? clockOut : null,
      })
      setEntries(current => [...current.filter(entry => entry.workday !== workday), saved]
        .sort((a, b) => a.workday.localeCompare(b.workday)))
      select()
    }, 'Schedule exception saved.')
  }

  function remove(date: string) {
    void update(async () => {
      await removeCompanyAttendanceException(deploymentId, date)
      setEntries(current => current.filter(entry => entry.workday !== date))
      if (workday === date) select()
    }, 'Exception removed. The regular schedule applies to that date.')
  }

  return <form className="hte-record-panel hte-reminder-schedule" onSubmit={save} aria-labelledby="hte-exception-heading" aria-busy={busy}>
    <header><div>
      <h2 id="hte-exception-heading">One-day schedule exceptions</h2>
      <p>Skip reminders or adjust shift times for a single date. Times are in Philippine time.</p>
    </div></header>
    <div className="hte-reminder-body">
      <div className="hte-reminder-times">
        <label>Date<input type="date" value={workday} required readOnly={editing} disabled={busy} onChange={event => setWorkday(event.target.value)} /></label>
        <label>Exception type<select ref={kindInput} value={kind} disabled={busy} onChange={event => setKind(event.target.value as AttendanceExceptionKind)}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      {kind === 'shift_change' && <div className="hte-reminder-times">
        <label>Adjusted shift starts<input type="time" value={clockIn} required disabled={busy} onChange={event => setClockIn(event.target.value)} /></label>
        <label>Adjusted shift ends<input type="time" value={clockOut} required disabled={busy} onChange={event => setClockOut(event.target.value)} /></label>
      </div>}
      <div className="hte-reminder-actions">
        <button className="stake-navy-button" type="submit" disabled={busy}>Save exception</button>
        {editing && <button className="hte-exception-secondary" type="button" disabled={busy} onClick={() => select()}>Cancel edit</button>}
      </div>
      {feedback && <p className={feedback.error ? 'hte-reminder-feedback hte-reminder-feedback--error' : 'hte-reminder-feedback'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      {entries.length > 0 && <ul className="hte-reminder-exceptions">
        {entries.map(entry => <li key={entry.workday}>
          <span><time dateTime={entry.workday}>{entry.workday}</time> · {labels[entry.kind]}
            {entry.kind === 'shift_change' && <> · {entry.clock_in_at?.slice(0, 5)}–{entry.clock_out_at?.slice(0, 5)}</>}
          </span>
          <div className="hte-reminder-actions">
            <button type="button" disabled={busy} aria-label={`Edit exception for ${entry.workday}`} onClick={() => {
              select(entry)
              kindInput.current?.focus()
            }}>Edit</button>
            <button type="button" disabled={busy} aria-label={`Remove exception for ${entry.workday}`} onClick={() => remove(entry.workday)}>Remove</button>
          </div>
        </li>)}
      </ul>}
    </div>
  </form>
}
