import { useEffect, useId, useRef, useState } from 'react'

export interface MonthlyCount { month: string; first: number; second: number }
export interface MonthlySeries { key: 'first' | 'second'; label: string; singular: string; color: string; dash?: string }
type Month = MonthlyCount
const monthLabel = (month: string) => new Date(month + '-01T00:00:00+08:00').toLocaleDateString('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', year: 'numeric',
})
export function MonthlyActivityChart({ history, title, description, emptyMessage,
  series: lines, footnote, excludedMessages = [],
  missingMessage = 'Progress history is unavailable. Update the backend and refresh.',
}: {
  history?: MonthlyCount[]
  title: string
  description: string
  emptyMessage: string
  series: readonly [MonthlySeries, MonthlySeries]
  footnote: string
  excludedMessages?: string[]
  missingMessage?: string
}) {
  const heading = useId()
  const [width, setWidth] = useState(640)
  const [focusedMonth, setFocusedMonth] = useState<string | null>(null)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, Math.round(entries[0].contentRect.width))))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const months = history ?? []
  const maxValue = Math.max(1, ...months.flatMap(month => [month.first, month.second]))
  const step = Math.max(1, Math.ceil(maxValue / 4))
  const left = 36, right = width - 24, top = 14, bottom = 194
  const x = (index: number) => months.length === 1 ? (left + right) / 2 : left + (right - left) * index / (months.length - 1)
  const y = (value: number) => bottom - (bottom - top) * value / (step * 4)
  const labelCount = width < 500 ? 3 : 5
  const ticks = [...new Set(Array.from({ length: Math.min(labelCount, months.length) }, (_, index) =>
    Math.round(index * (months.length - 1) / Math.max(1, Math.min(labelCount, months.length) - 1))))]
  const selected = months.find(month => month.month === focusedMonth) ?? months.at(-1)
  const describe = (month: Month) => monthLabel(month.month) + ': ' +
    month.first + ' ' + (month.first === 1 ? lines[0].singular : lines[0].label.toLowerCase()) + ', ' +
    month.second + ' ' + (month.second === 1 ? lines[1].singular : lines[1].label.toLowerCase())


  return <section className="internship-progress" aria-labelledby={heading}>
    <div className="internship-progress__heading"><div><h2 id={heading}>{title}</h2><p>{description}</p></div></div>
    <div className="internship-progress__legend" aria-label="Progress chart legend">{lines.map(line => <span key={line.key}><i style={{ backgroundColor: line.color }} />{line.label}{' '}</span>)}</div>
    <div ref={container} className="internship-progress__plot">
      {!history ? <p role="status">{missingMessage}</p> :
        !months.length ? <p role="status">{emptyMessage}</p> : <>
          <svg width="100%" height="230" viewBox={`0 0 ${width} 230`} role="img" aria-label={title + '. Exact counts are available in the table below.'}>
            <title>{title}</title>
            {[0, 1, 2, 3, 4].map(index => <g key={index}>
              <line x1={left} x2={right} y1={y(index * step)} y2={y(index * step)} stroke="#e2e3ec" />
              <text x={left - 8} y={y(index * step) + 4} textAnchor="end">{index * step}</text>
            </g>)}
            {ticks.map(index => <text key={index} x={x(index)} y={218} textAnchor={months.length === 1 ? 'middle' : index === 0 ? 'start' : index === months.length - 1 ? 'end' : 'middle'}>{monthLabel(months[index].month)}</text>)}
            {lines.map(line => <g key={line.key}>
              <path className="internship-progress__line" d={months.map((month, index) => `${index ? 'L' : 'M'}${x(index)},${y(month[line.key])}`).join(' ')} fill="none" stroke={line.color} strokeWidth={2.5} strokeDasharray={line.dash} />
              {months.map((month, index) => <circle key={month.month} cx={x(index)} cy={y(month[line.key])} r={3.5} fill="white" stroke={line.color} strokeWidth={2} tabIndex={0}
                aria-label={`${monthLabel(month.month)}, ${line.label}: ${month[line.key]}`}
                onFocus={() => setFocusedMonth(month.month)} onBlur={() => setFocusedMonth(null)}
                onMouseEnter={() => setFocusedMonth(month.month)} onMouseLeave={() => setFocusedMonth(null)}>
                <title>{monthLabel(month.month)} · {line.label}: {month[line.key]}</title>
              </circle>)}
            </g>)}
          </svg>
          {selected && <p className="internship-progress__detail" aria-live="polite">{describe(selected)}</p>}
          <details className="internship-progress__data"><summary>View monthly counts</summary>
            <div className="internship-progress__table-wrap"><table><caption className="internship-progress__sr-only">{title} for the dashboard academic term</caption><thead><tr><th scope="col">Month</th>{lines.map(line => <th key={line.key} scope="col">{line.label}</th>)}</tr></thead>
              <tbody>{months.map(month => <tr key={month.month}><th scope="row">{monthLabel(month.month)}</th><td>{month.first}</td><td>{month.second}</td></tr>)}</tbody>
            </table></div>
          </details>
        </>}
    </div>
    <p className="internship-progress__footnote">{footnote}</p>
    {excludedMessages.length > 0 && <p className="internship-progress__excluded">Excluded from the chart: {excludedMessages.join('; ')}.</p>}
  </section>
}
