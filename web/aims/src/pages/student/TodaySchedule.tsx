import type { TodayAttendanceSchedule } from '../../services/studentService'

const labels: Record<TodayAttendanceSchedule['status'], string> = {
  regular_shift: 'Regular shift',
  shift_change: 'Adjusted shift',
  holiday: 'Holiday',
  approved_absence: 'Approved absence',
  company_holiday: 'Company holiday',
  day_off: 'Scheduled day off',
  no_schedule: 'Your company has not set a schedule yet.',
  not_started: 'Your internship has not started yet.',
  not_deployed: 'Your schedule will appear after deployment approval.',
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(':')
  const hour = Number(hours)
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function TodaySchedule({ data, loading, retry }: {
  data: TodayAttendanceSchedule | null; loading: boolean; retry: () => void
}) {
  return <section className="sw-card" aria-labelledby="today-schedule">
    <h2 id="today-schedule">Today’s schedule</h2>
    {data ? <>
      <p><time dateTime={data.date}>{new Date(data.date + 'T00:00:00Z').toLocaleDateString('en-PH', {
        timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
      })}</time> · Philippine time</p>
      <p><strong>{labels[data.status]}</strong></p>
      {data.clock_in_at && data.clock_out_at && <dl className="sw-today-shift">
        <div><dt>Expected clock-in</dt><dd>{formatTime(data.clock_in_at)}</dd></div>
        <div><dt>Expected clock-out</dt><dd>{formatTime(data.clock_out_at)}</dd></div>
      </dl>}
    </> : loading ? <p role="status">Loading schedule…</p> : <>
      <p role="status">Could not load today’s schedule.</p>
      <button type="button" onClick={retry}>Retry schedule</button>
    </>}
  </section>
}
