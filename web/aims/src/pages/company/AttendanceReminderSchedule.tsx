import { AttendanceReminderExceptions } from './AttendanceReminderExceptions'
import { useRef, useState, type FormEvent } from 'react'
import { saveCompanyAttendanceSchedule, type AttendanceSchedule, type AttendanceScheduleException } from '../../services/companyMonitoringService'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function AttendanceReminderSchedule({
  deploymentId, schedule, exceptions,
}: { deploymentId: string; schedule: AttendanceSchedule | null; exceptions: AttendanceScheduleException[] }) {
  const [hasSchedule, setHasSchedule] = useState(Boolean(schedule))
  const [workdays, setWorkdays] = useState(schedule?.workdays ?? [0, 1, 2, 3, 4])
  const [clockIn, setClockIn] = useState(schedule?.clock_in_at.slice(0, 5) ?? '')
  const [clockOut, setClockOut] = useState(schedule?.clock_out_at.slice(0, 5) ?? '')
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const saving = useRef(false)

  function toggleDay(day: number, checked: boolean) {
    setWorkdays(current => checked ? [...current, day] : current.filter(value => value !== day))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current) return
    if (!workdays.length || clockOut <= clockIn) {
      setFeedback({
        error: true,
        text: !workdays.length ? 'Select at least one workday.' : 'Clock-out must be later than clock-in on the same day.',
      })
      return
    }
    saving.current = true
    setBusy(true)
    setFeedback(null)
    try {
      await saveCompanyAttendanceSchedule(deploymentId, {
        workdays, clock_in_at: clockIn, clock_out_at: clockOut, enabled,
      })
      setHasSchedule(true)
      setFeedback({ error: false, text: enabled ? 'Attendance reminder schedule saved.' : 'Attendance reminders paused.' })
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : 'Could not save the reminder schedule.' })
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return <>
    <form className="hte-record-panel hte-reminder-schedule" onSubmit={save} aria-labelledby="hte-reminder-heading" aria-busy={busy}>
      <header><div>
        <h2 id="hte-reminder-heading">Attendance reminder schedule</h2>
        <p>AIMS sends reminders 10 minutes before and after each scheduled time if the intern still needs to clock in or out. Times are in Philippine time.</p>
      </div></header>
      <div className="hte-reminder-body">
        <fieldset disabled={busy}>
          <legend>Workdays</legend>
          <div className="hte-reminder-days">
            {days.map((label, index) => <label key={label}>
              <input type="checkbox" checked={workdays.includes(index)} onChange={event => toggleDay(index, event.target.checked)} />
              {label}
            </label>)}
          </div>
        </fieldset>
        <div className="hte-reminder-times">
          <label>Shift starts<input type="time" value={clockIn} required disabled={busy} onChange={event => setClockIn(event.target.value)} /></label>
          <label>Shift ends<input type="time" value={clockOut} required disabled={busy} onChange={event => setClockOut(event.target.value)} /></label>
        </div>
        <div className="hte-reminder-actions">
          <label><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} /><span>Send clock-in and clock-out reminders</span></label>
          <button className="stake-navy-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save schedule'}</button>
        </div>
        {feedback && <p className={feedback.error ? 'hte-reminder-feedback hte-reminder-feedback--error' : 'hte-reminder-feedback'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      </div>
    </form>
    {hasSchedule && <AttendanceReminderExceptions deploymentId={deploymentId} initialExceptions={exceptions} />}
  </>
}
