import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icons'
import { getCompanyInterns, getCompanyInternDetail } from '../../services/companyMonitoringService'
import type { CompanyInternPage, CompanyInternDetail } from '../../services/companyMonitoringService'
import './intern-monitoring.css'

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Status({ value }: { value: string }) {
  const label = value === 'deployed' ? 'Active internship' : value.replaceAll('_', ' ')
  return <span className={`hte-status hte-status--${value}`}>{label}</span>
}

function Pages({ page, total, limit, onChange, label }: { page: number; total: number; limit: number; onChange: (page: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return <nav className="hte-pagination" aria-label={label}><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></nav>
}

export function InternMonitoringPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [roster, setRoster] = useState<CompanyInternPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<CompanyInternDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [attendancePage, setAttendancePage] = useState(1)
  const [journalPage, setJournalPage] = useState(1)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setSelected(''); setDetail(null)
    setAttendancePage(1); setJournalPage(1)
    getCompanyInterns(page, query, status, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setRoster(result); setSelected(result.items[0]?.deployment_id ?? '')
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) { setRoster(null); setError(err instanceof Error ? err.message : 'Unable to load your interns.') }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, query, status, refresh])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    setDetailLoading(true); setDetailError('')
    getCompanyInternDetail(selected, attendancePage, journalPage, controller.signal).then(result => {
      if (!controller.signal.aborted) setDetail(result)
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) { setDetail(null); setDetailError(err instanceof Error ? err.message : 'Unable to load this intern.') }
    }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selected, attendancePage, journalPage, refresh])

  function choose(id: string) { setAttendancePage(1); setJournalPage(1); setSelected(id) }
  const current = detail?.intern.deployment_id === selected ? detail : null
  const progress = Math.min(100, Math.max(0, current?.progress_percent ?? 0))

  return <section className="workspace-page hte-monitoring">
    <header className="hte-heading"><div><span className="stake-kicker">CITC / WORKPLACE SUPERVISION</span><h1>Interns at your establishment</h1><p>A workplace view of attendance, approved hours, and submitted journal summaries.</p></div><button type="button" className="stake-navy-button" disabled={loading || detailLoading} onClick={() => setRefresh(value => value + 1)}><Icon name="clock" size={16} />Refresh records</button></header>
    <div className="hte-scope"><Icon name="briefcase" size={24} /><div><strong>Company supervision</strong><p>Only confirmed placements at your assigned host companies appear here. Academic grading, requirement verification, and deployment confirmation remain with the school.</p></div>{roster && <span>AY {roster.academic_year}<br />Semester {roster.semester}</span>}</div>
    <div className="hte-filters"><label><Icon name="search" size={17} /><input aria-label="Search company interns" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Search intern, student number, or company" /></label><select aria-label="Filter internships by status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">All confirmed placements</option><option value="deployed">Active internships</option><option value="completed">Completed internships</option></select><span aria-live="polite">{loading ? 'Loading roster…' : `${roster?.total ?? 0} matching placements`}</span></div>
    {error && <div className="hte-alert" role="alert"><strong>Unable to load intern records</strong><p>{error}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
    <div className="hte-workspace">
      <aside className="hte-roster" aria-label="Company intern roster"><header><h2>Your intern roster</h2><span>Confirmed deployments</span></header>{loading ? <p className="hte-empty" role="status">Loading your interns…</p> : roster?.items.length ? <><div className="hte-intern-list">{roster.items.map(intern => <button type="button" key={intern.deployment_id} aria-pressed={selected === intern.deployment_id} className={selected === intern.deployment_id ? 'is-selected' : ''} onClick={() => choose(intern.deployment_id)}><span className="hte-initials">{intern.student_name.split(' ').filter(Boolean).map(part => part[0]).slice(0,2).join('')}</span><span><strong>{intern.student_name}</strong><small>{intern.student_number || 'Student number unavailable'}</small><small>{intern.company_name}</small><Status value={intern.status} /></span></button>)}</div><Pages page={page} total={roster.total} limit={roster.limit} onChange={setPage} label="Intern roster pages" /></> : !error && <div className="hte-empty"><Icon name="users" size={27} /><h3>No matching interns</h3><p>{query || status !== 'all' ? 'Try another name or status filter.' : 'Interns appear after the school confirms their deployment. Ask an administrator to check your company assignment if an expected placement is missing.'}</p></div>}</aside>
      <div className="hte-detail" aria-live="polite">{detailError ? <div className="hte-alert" role="alert"><strong>Unable to load intern details</strong><p>{detailError}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div> : detailLoading && selected ? <p className="hte-empty" role="status">Loading workplace records…</p> : current ? <>
        <section className="hte-profile"><div><span className="stake-kicker">WORKPLACE PROGRESS</span><h2>{current.intern.student_name}</h2><p>{current.intern.company_name} · Started {formatDate(current.intern.deployment_date)}</p></div><Status value={current.intern.status} /></section>
        {!current.records_available ? <div className="hte-attribution" role="status"><Icon name="file" size={25} /><h3>Company attribution needs reconciliation</h3><p>{current.notice}</p><p>Hours are unavailable rather than shown as zero.</p></div> : <>
          <section className="hte-hours" aria-label="Intern approved hours"><div><span>School-approved hours</span><strong>{current.approved_hours ?? '—'}<small> / {current.required_hours}h</small></strong></div><div><span>Remaining hours</span><strong>{current.remaining_hours ?? '—'}<small>h</small></strong></div><div className="hte-progress"><span>{current.progress_percent ?? '—'}% complete</span><div role="progressbar" aria-label="School-approved internship hours" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div><small>Pending and rejected time is excluded.</small></div></section>
          <section className="hte-record-panel"><header><div><span className="stake-kicker">ATTENDANCE & WORK LOG</span><h2>Daily time records</h2></div><span>{current.attendance_total} records</span></header>{current.attendance.length ? <div className="hte-table-wrap"><table><caption className="hte-sr-only">Workplace attendance records for {current.intern.student_name}</caption><thead><tr><th>Date & time</th><th>Logged hours</th><th>School review</th><th>Work completed</th></tr></thead><tbody>{current.attendance.map(record => <tr key={record.id}><td><strong>{formatDate(record.date)}</strong><small>{record.time_in.slice(0,5)} – {record.time_out?.slice(0,5) || 'Time-out pending'}</small></td><td>{record.total_hours ?? '—'}h</td><td><Status value={record.status} /></td><td>{record.tasks_completed || 'No work summary provided.'}</td></tr>)}</tbody></table></div> : <p className="hte-empty">No attendance records have been recorded since deployment.</p>}<Pages page={attendancePage} total={current.attendance_total} limit={current.limit} onChange={setAttendancePage} label="Attendance record pages" /></section>
          <section className="hte-record-panel"><header><div><span className="stake-kicker">STUDENT REFLECTIONS</span><h2>Submitted journal summaries</h2></div><span>{current.journal_total} journals</span></header>{current.journals.length ? <div className="hte-journals">{current.journals.map(journal => <article key={journal.id}><div><span>Week {journal.week}</span><Status value={journal.status} /></div><h3>{journal.title}</h3><p>{journal.summary || 'No summary was provided.'}</p><small>Submitted {formatDate(journal.submitted_date)}</small></article>)}</div> : <p className="hte-empty">No submitted journal summaries are available since deployment.</p>}<Pages page={journalPage} total={current.journal_total} limit={current.limit} onChange={setJournalPage} label="Submitted journal pages" /></section>
        </>}
      </> : !loading && <div className="hte-empty"><Icon name="briefcase" size={30} /><h3>Select an intern to begin</h3><p>Review workplace progress without changing the school's academic records.</p></div>}</div>
    </div>
  </section>
}
