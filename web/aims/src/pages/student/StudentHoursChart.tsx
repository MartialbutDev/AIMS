import { useEffect, useId, useRef, useState } from 'react'
import { studentApi, type ApprovedHoursProgress } from '../../services/studentService'
import { useStudentLoad } from './studentHooks'

const hours = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 2 })
const dateLabel = (value: string, full = false) => new Date(value + 'T00:00:00+08:00').toLocaleDateString('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', ...(full ? { year: 'numeric' as const } : {}),
})

export function StudentHoursChart() {
  const state = useStudentLoad(() => studentApi<ApprovedHoursProgress>('/reports/approved-hours-progress'))
  const heading = useId()
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [focusedDate, setFocusedDate] = useState<string | null>(null)
  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, Math.round(entries[0].contentRect.width))))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const data = state.data
  const points = data?.points ?? []
  const target = data?.required_hours ?? null
  const maxValue = Math.max(1, target ?? 0, ...points.map(point => point.cumulative_hours))
  const step = Math.max(1, Math.ceil(maxValue / 4))
  const left = 52, right = width - 24, top = 14, bottom = 194
  const first = points.length ? Date.parse(points[0].date) : 0
  const last = points.length ? Date.parse(points[points.length - 1].date) : 0
  const x = (date: string) => first === last ? (left + right) / 2 : left + (right - left) * (Date.parse(date) - first) / (last - first)
  const y = (value: number) => bottom - (bottom - top) * value / (step * 4)
  const count = Math.min(width < 500 ? 3 : 5, points.length)
  const ticks = [...new Set(Array.from({ length: count }, (_, index) => Math.round(index * (points.length - 1) / Math.max(1, count - 1))))]
  const selected = points.find(point => point.date === focusedDate) ?? points.at(-1)

  return <section className="sw-card student-hours-chart" aria-labelledby={heading}>
    <div className="sw-section-head"><h2 id={heading}>Approved hours progress</h2><button type="button" disabled={state.loading} onClick={state.refresh}>Refresh hours</button></div>
    {data && <p className="student-hours-term">AY {data.academic_year} · Semester {data.semester}</p>}
    {state.error && <p className="sw-notice" role="alert">{state.error}</p>}
    {state.loading && <p role="status">Loading approved hours…</p>}
    {data && <>
      <div className="student-hours-legend" aria-label="Hours chart legend"><span><i />Approved hours</span>{target !== null && <span><i className="student-hours-target-key" />Required hours: {hours(target)}h</span>}</div>
      {target === null && <p className="student-hours-target-notice">Required hours awaiting configuration.</p>}
    </>}
    <div ref={container} className="student-hours-plot">
      {data && (points.length ? <>
        <svg width="100%" height="230" viewBox={`0 0 ${width} 230`} role="img" aria-label="Cumulative fully approved attendance hours by work date. Exact counts are available below.">
          <title>Approved internship hours</title>
          {[0, 1, 2, 3, 4].map(index => <g key={index}><line x1={left} x2={right} y1={y(index * step)} y2={y(index * step)} stroke="#e2e3ec" /><text x={left - 8} y={y(index * step) + 4} textAnchor="end">{hours(index * step)}</text></g>)}
          {ticks.map(index => <text key={index} x={x(points[index].date)} y={218} textAnchor={points.length === 1 ? 'middle' : index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{dateLabel(points[index].date)}</text>)}
          {target !== null && <line className="student-hours-target" x1={left} x2={right} y1={y(target)} y2={y(target)} stroke="#a66b00" strokeWidth={2} strokeDasharray="6 4"><title>Required hours: {hours(target)}h</title></line>}
          <path className="student-hours-line" d={points.map((point, index) => `${index ? 'L' : 'M'}${x(point.date)},${y(point.cumulative_hours)}`).join(' ')} fill="none" stroke="#0b0b2f" strokeWidth={2.5} />
          {points.map(point => <circle key={point.date} cx={x(point.date)} cy={y(point.cumulative_hours)} r={3.5} fill="white" stroke="#0b0b2f" strokeWidth={2} tabIndex={0}
            aria-label={`${dateLabel(point.date, true)}: ${hours(point.cumulative_hours)} approved hours`}
            onFocus={() => setFocusedDate(point.date)} onBlur={() => setFocusedDate(null)}
            onMouseEnter={() => setFocusedDate(point.date)} onMouseLeave={() => setFocusedDate(null)}>
            <title>{dateLabel(point.date)} · {hours(point.cumulative_hours)}h approved</title>
          </circle>)}
        </svg>
        {selected && <p className="student-hours-detail" aria-live="polite">{dateLabel(selected.date, true)} · {hours(selected.cumulative_hours)}h approved</p>}
        <details className="student-hours-data"><summary>View approved hours</summary><div className="student-hours-table"><table><caption className="student-hours-sr-only">Approved hours by attendance date</caption><thead><tr><th scope="col">Date</th><th scope="col">Hours that day</th><th scope="col">Cumulative hours</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><th scope="row">{dateLabel(point.date, true)}</th><td>{hours(point.daily_hours)}</td><td>{hours(point.cumulative_hours)}</td></tr>)}</tbody></table></div></details>
      </> : <p role="status">No approved attendance yet.</p>)}
    </div>
    {data && <p className="student-hours-note">Company-confirmed and coordinator-approved · By attendance date</p>}
  </section>
}
