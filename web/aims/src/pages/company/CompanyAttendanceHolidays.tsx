import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  getCompanyAttendanceHolidays, updateCompanyAttendanceHoliday, type CompanyHolidaySchedule,
} from '../../services/companyMonitoringService'

function todayInPhilippines() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

function displayDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CompanyAttendanceHolidays() {
  const [companies, setCompanies] = useState<CompanyHolidaySchedule[] | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const saving = useRef(false)
  const company = companies?.find(item => item.company_id === companyId) ?? companies?.[0]

  useEffect(() => {
    const controller = new AbortController()
    getCompanyAttendanceHolidays(controller.signal).then(result => {
      if (!controller.signal.aborted) setCompanies(result)
    }).catch(error => {
      if (!controller.signal.aborted) setFeedback({
        error: true, text: error instanceof Error ? error.message : 'Could not load company holidays.',
      })
    })
    return () => controller.abort()
  }, [])

  async function save(workday: string, method: 'PUT' | 'DELETE') {
    if (!company || saving.current) return
    saving.current = true
    setBusy(true)
    setFeedback(null)
    const adding = method === 'PUT'
    try {
      await updateCompanyAttendanceHoliday(company.company_id, workday, method)
      setCompanies(current => current?.map(item => item.company_id === company.company_id ? {
        ...item,
        holidays: adding ? [...new Set([...item.holidays, workday])].sort() : item.holidays.filter(day => day !== workday),
      } : item) ?? null)
      if (adding) setDate('')
      setFeedback({ error: false, text: adding ? 'Company holiday saved.' : 'Company holiday removed.' })
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : 'Could not update the company holiday.' })
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save(date, 'PUT')
  }

  if (companies?.length === 0) return null

  return <form className="hte-record-panel hte-reminder-schedule hte-company-holidays" onSubmit={submit} aria-labelledby="hte-company-holidays-heading" aria-busy={busy}>
    <header>
      <h2 id="hte-company-holidays-heading">Company-wide holidays</h2>
      <p>Skip clock-in and clock-out reminders for all active interns at the selected company on a Philippine calendar date.</p>
    </header>
    <div className="hte-reminder-body">
      {company ? <>
        <div className="hte-reminder-times">
          <label>Company<select value={company.company_id} disabled={busy} onChange={event => {
            setCompanyId(event.target.value)
            setFeedback(null)
          }}>
            {companies?.map(item => <option key={item.company_id} value={item.company_id}>{item.company_name}</option>)}
          </select></label>
          <label>Holiday date<input type="date" value={date} min={todayInPhilippines()} required disabled={busy} onChange={event => setDate(event.target.value)} /></label>
        </div>
        <div className="hte-reminder-actions">
          <button className="stake-navy-button" type="submit" disabled={busy}>Save company holiday</button>
        </div>
        {company.holidays.length > 0 && <ul className="hte-reminder-exceptions" aria-label="Upcoming company holidays">
          {company.holidays.map(day => <li key={day}>
            <time dateTime={day}>{displayDate(day)}</time>
            <button type="button" disabled={busy} aria-label={`Remove company holiday for ${displayDate(day)}`} onClick={() => void save(day, 'DELETE')}>Remove</button>
          </li>)}
        </ul>}
      </> : !feedback && <p className="hte-empty" role="status">Loading company holidays…</p>}
      {feedback && <p className={feedback.error ? 'hte-reminder-feedback hte-reminder-feedback--error' : 'hte-reminder-feedback'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    </div>
  </form>
}
