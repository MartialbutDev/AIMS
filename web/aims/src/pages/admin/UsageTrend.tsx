import { useEffect, useId, useRef, useState } from 'react'

export interface DailyUsage {
  date: string
  total_users: number | null
  web_users: number | null
  mobile_users: number | null
}

type SeriesKey = 'total_users' | 'web_users' | 'mobile_users'
const series: { key: SeriesKey; label: string; color: string; dash?: string }[] = [
  { key: 'total_users', label: 'Total users', color: '#0b0b2f' },
  { key: 'web_users', label: 'Web', color: '#a66b00', dash: '6 4' },
  { key: 'mobile_users', label: 'Mobile app', color: '#087f8c', dash: '2 4' },
]
const formatDate = (date: string, full = false) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', ...(full ? { year: 'numeric' as const } : {}),
})

export function UsageTrend({ daily, trackingStartedAt }: { daily?: DailyUsage[]; trackingStartedAt?: string | null }) {
  const [days, setDays] = useState(7)
  const [showPlatforms, setShowPlatforms] = useState(false)
  const [focusedDate, setFocusedDate] = useState<string | null>(null)
  const [width, setWidth] = useState(640)
  const chart = useRef<HTMLDivElement>(null)
  const headingId = useId()
  useEffect(() => {
    const element = chart.current
    if (!element) return
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, Math.round(entries[0].contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const rows = daily?.slice(-days) ?? []
  const visibleSeries = showPlatforms ? series : series.slice(0, 1)
  const hasData = rows.some(row => row.total_users !== null)
  const maxValue = Math.max(1, ...rows.flatMap(row => visibleSeries.map(item => row[item.key] ?? 0)))
  const step = Math.max(1, Math.ceil(maxValue / 4))
  const maxY = step * 4
  const left = 36, right = width - 24, top = 14, bottom = 194
  const x = (index: number) => left + (right - left) * index / Math.max(1, rows.length - 1)
  const y = (value: number) => bottom - (bottom - top) * value / maxY
  const tickIndexes = width < 450 || days === 7 ? [0, Math.floor((rows.length - 1) / 2), rows.length - 1] : [0, 7, 14, 21, rows.length - 1]
  const focused = rows.find(row => row.date === focusedDate) ?? rows.at(-1)
  function line(key: SeriesKey) {
    let connected = false
    return rows.map((row, index) => {
      if (row[key] === null) { connected = false; return '' }
      const point = `${connected ? 'L' : 'M'}${x(index)},${y(row[key])}`
      connected = true
      return point
    }).join(' ')
  }
  const description = (row: DailyUsage) => `${formatDate(row.date, true)}: ${row.total_users === null ? 'No data' : `${row.total_users} total users, ${row.web_users} web, ${row.mobile_users} mobile app`}`

  return <section className="usage-trend" aria-labelledby={headingId}>
    <div className="usage-trend-heading">
      <div><h3 id={headingId}>Daily usage</h3><p>Unique users each day · Philippine time</p></div>
      <div className="usage-trend-period" role="group" aria-label="Usage chart period">
        {[7, 30].map(value => <button key={value} type="button" aria-pressed={days === value} onClick={() => { setDays(value); setFocusedDate(null) }}>{value} days</button>)}
      </div>
    </div>
    <label className="usage-trend-toggle"><input type="checkbox" checked={showPlatforms} onChange={event => setShowPlatforms(event.target.checked)} />Show web and mobile</label>
    <div className="usage-trend-legend" aria-label="Chart legend">{visibleSeries.map(item => <span key={item.key}><i style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>
    <div ref={chart} className="usage-trend-plot">
      {!daily ? <p role="status">Daily usage is unavailable. Update the backend and refresh usage.</p> : !hasData ? <p role="status">No usage data recorded yet.</p> : <>
        <svg viewBox={`0 0 ${width} 230`} width="100%" height="230" role="img" aria-label={`Daily unique users over the last ${days} days. Dates before tracking began have no data.`}>
          <title>Daily AIMS usage</title>
          {[0, 1, 2, 3, 4].map(index => <g key={index}>
            <line x1={left} y1={y(index * step)} x2={right} y2={y(index * step)} stroke="#e2e3ec" />
            <text x={left - 8} y={y(index * step) + 4} textAnchor="end">{index * step}</text>
          </g>)}
          {tickIndexes.filter(index => index >= 0).map(index => <text key={index} x={x(index)} y={218} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}>{formatDate(rows[index].date)}</text>)}
          {visibleSeries.map(item => <g key={item.key}>
            <path className="usage-trend-line" d={line(item.key)} fill="none" stroke={item.color} strokeWidth={2.5} strokeDasharray={item.dash} />
            {rows.map((row, index) => row[item.key] === null ? null : <circle key={row.date} cx={x(index)} cy={y(row[item.key] ?? 0)} r={3.5} fill="white" stroke={item.color} strokeWidth={2} tabIndex={0}
              aria-label={`${formatDate(row.date, true)}, ${item.label}: ${row[item.key]}`}
              onFocus={() => setFocusedDate(row.date)} onBlur={() => setFocusedDate(null)}
              onMouseEnter={() => setFocusedDate(row.date)} onMouseLeave={() => setFocusedDate(null)}>
              <title>{formatDate(row.date)} · {item.label}: {row[item.key]}</title>
            </circle>)}
          </g>)}
        </svg>
        {focused && <p className="usage-trend-detail" aria-live="polite">{description(focused)}</p>}
      </>}
    </div>
    {daily && <>
      <p className="usage-trend-note">{trackingStartedAt ? `Tracking began ${new Date(trackingStartedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}. ` : ''}Dates before tracking began show “No data”. Today’s count is still updating.</p>
      <details className="usage-trend-data"><summary>View daily counts</summary>
        <div className="system-usage-table"><table><caption>Daily unique users · last {days} days</caption><thead><tr><th scope="col">Date</th><th scope="col">Total</th><th scope="col">Web</th><th scope="col">Mobile</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.date}><th scope="row">{formatDate(row.date, true)}</th>{series.map(item => <td key={item.key}>{row[item.key] ?? 'No data'}</td>)}</tr>)}</tbody>
        </table></div>
      </details>
    </>}
  </section>
}
