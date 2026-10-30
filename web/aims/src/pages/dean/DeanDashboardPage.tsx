import { useEffect, useRef, useState } from 'react'
import { getDeanAnalytics, getDeanAttention, getDeanTerms, termLabel, type AcademicTerm, type AttentionCategory, type AttentionDetails, type DeanAnalytics } from '../../services/deanAnalyticsService'
import './dean-dashboard.css'

const cards: { key: keyof DeanAnalytics['overview']; label: string; caption: string }[] = [
  { key: 'students_in_oversight', label: 'Students in oversight', caption: 'Assigned within your designation scope' },
  { key: 'awaiting_deployment', label: 'Awaiting deployment', caption: 'Placement accepted; deployment not confirmed' },
  { key: 'active_interns', label: 'Active interns', caption: 'Includes interns completing final review' },
  { key: 'pending_completion', label: 'Pending completion', caption: 'Requested, returned or company-confirmed' },
  { key: 'approved_completion', label: 'Coordinator-approved completion', caption: 'Official approval recorded' },
  { key: 'grades_released', label: 'Grades released', caption: 'Subset of approved completions' },
]
type Selection = { category: AttentionCategory; title: string; coordinator: string }

export function DeanDashboardPage() {
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [term, setTerm] = useState<AcademicTerm | null>(null)
  const [data, setData] = useState<DeanAnalytics | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [page, setPage] = useState(1)
  const [details, setDetails] = useState<AttentionDetails | null>(null)
  const [detailError, setDetailError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const backButton = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    getDeanTerms(controller.signal).then(result => {
      if (controller.signal.aborted) return
      setTerms(result.items)
      setTerm(previous => previous ?? result.current)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load academic terms.') })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    if (!term) return
    const controller = new AbortController()
    setData(null)
    setError('')
    getDeanAnalytics(term, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load oversight data.') })
    return () => controller.abort()
  }, [term, refresh])

  useEffect(() => {
    if (!selection || !term) return
    const controller = new AbortController()
    setDetails(null)
    setDetailError('')
    getDeanAttention(term, selection.category, page, selection.coordinator, controller.signal).then(result => {
      if (!controller.signal.aborted) setDetails(result)
    }).catch(reason => { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : 'Could not load details.') })
    return () => controller.abort()
  }, [selection, term, page, refresh])

  useEffect(() => {
    if (selection && !dialog.current?.open) dialog.current?.showModal()
    if (!selection && dialog.current?.open) dialog.current.close()
  }, [selection])

  function openDetails(category: AttentionCategory, title: string, coordinator = '') {
    backButton.current = document.activeElement as HTMLElement
    setPage(1)
    setDetails(null)
    setSelection({ category, title, coordinator })
  }
  function closeDetails() {
    setSelection(null)
    setDetails(null)
    backButton.current?.focus()
  }
  function changeTerm(next: AcademicTerm) {
    setData(null)
    setError('')
    closeDetails()
    setTerm(next)
  }
  const years = [...new Set(terms.map(item => item.academic_year))]
  const semesters = terms.filter(item => item.academic_year === term?.academic_year).map(item => item.semester).sort()
  const maxStage = Math.max(1, ...(data?.stages.map(item => item.count) ?? []))

  return <div className="dean-oversight">
    <header className="dean-oversight__hero">
      <div><span className="dean-oversight__eyebrow">CITC · DEAN'S OFFICE</span><h1>Internship oversight</h1><p>A clear view of placement, progress and official completion.</p></div>
      <span className="dean-oversight__badge">Read-only oversight</span>
    </header>
    <section className="dean-oversight__term" aria-label="Dashboard academic term">
      <div><strong>Academic term</strong><small>One selection applies to every section below.</small></div>
      <label>Academic year<select value={term?.academic_year ?? ''} disabled={!terms.length} onChange={event => {
        const year = event.target.value
        const next = terms.find(item => item.academic_year === year && item.semester === term?.semester) ?? terms.find(item => item.academic_year === year)
        if (next) changeTerm(next)
      }}>{!term && <option value="">Loading…</option>}{years.map(year => <option key={year}>{year}</option>)}</select></label>
      <label>Semester<select value={term?.semester ?? ''} disabled={!term} onChange={event => term && changeTerm({ ...term, semester: event.target.value })}>{!term && <option value="">—</option>}{semesters.map(semester => <option key={semester} value={semester}>Semester {semester}</option>)}</select></label>
      <button className="dean-oversight__button" onClick={() => setRefresh(value => value + 1)}>Refresh</button>
    </section>
    {error && <div className="dean-oversight__notice" role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
    {!data && !error && <p role="status" className="dean-oversight__notice">Loading {term ? termLabel(term) : 'academic terms'}…</p>}
    {data && <>
      <div className="dean-oversight__caption"><span>{termLabel(data)}</span><span>Updated {new Date(data.generated_at).toLocaleString()}</span></div>
      <section className="dean-oversight__cards" aria-label="Internship overview">
        {cards.map((card, index) => <article key={card.key} className={`dean-oversight__metric${index === 0 ? ' dean-oversight__metric--primary' : ''}`}><span>{card.label}</span><strong>{data.overview[card.key].toLocaleString()}</strong><small>{card.caption}</small></article>)}
      </section>
      {!data.overview.students_in_oversight && <p className="dean-oversight__notice">No assigned students are available in your oversight scope for this term. Coordinator designations are managed by the administrator.</p>}
      <section className="dean-oversight__panel" aria-labelledby="dean-stage-heading">
        <div className="dean-oversight__section-heading"><div><h2 id="dean-stage-heading">Where students are now</h2><p>Each student appears in one stage. Completion in progress is included in the active-intern overview card.</p></div><span>{data.overview.students_in_oversight} students</span></div>
        <div className="dean-oversight__chart">{data.stages.map(stage => <div className="dean-oversight__bar-row" key={stage.key}><span>{stage.label}</span><div className="dean-oversight__track" role="img" aria-label={`${stage.label}: ${stage.count} students`}><span style={{ width: `${stage.count / maxStage * 100}%` }} /></div><strong>{stage.count}</strong></div>)}</div>
        <p className="dean-oversight__footnote">Historical completed records without recorded coordinator approval are shown separately. Conflicting records require reconciliation before they count as active or approved.</p>
      </section>
      <section className="dean-oversight__panel" aria-labelledby="dean-workload-heading">
        <div className="dean-oversight__section-heading"><div><h2 id="dean-workload-heading">Coordinator workload</h2><p>Assigned students and outstanding review items in the selected term.</p></div><span>{data.workloads.length} coordinators</span></div>
        <div className="dean-oversight__table-wrap"><table><caption className="dean-oversight__sr-only">Coordinator workload for {termLabel(data)}</caption><thead><tr><th scope="col">Coordinator</th><th scope="col">Assigned students</th><th scope="col">Active interns</th><th scope="col">Documents</th><th scope="col">DTRs</th><th scope="col">Journals</th><th scope="col">Final approvals</th><th scope="col">Total review items</th></tr></thead><tbody>
          {data.workloads.map(row => <tr key={row.coordinator_id}><th scope="row">{row.coordinator_name}</th><td>{row.assigned_students}</td><td>{row.active_interns}</td><td>{row.document_reviews}</td><td>{row.dtr_reviews}</td><td>{row.journal_reviews}</td><td>{row.completion_reviews}</td><td><strong>{row.total_reviews}</strong>{row.total_reviews > 0 && <button className="dean-oversight__link" onClick={() => openDetails(row.completion_reviews > 0 ? 'coordinator_approval' : 'pending_reviews', `Review details · ${row.coordinator_name}`, row.coordinator_id)}>View details</button>}</td></tr>)}
          {!data.workloads.length && <tr><td colSpan={8}>No active coordinator designations for this term.</td></tr>}
        </tbody></table></div>
        <p className="dean-oversight__footnote">Review counts are items, not students. DTRs count only after clock-out submission; journals count when submitted or in review. Approved archives are excluded.</p>
      </section>
      <section className="dean-oversight__panel" aria-labelledby="dean-attention-heading">
        <div className="dean-oversight__section-heading"><div><h2 id="dean-attention-heading">Attention needed</h2><p>Identify follow-up needs without changing student records.</p></div></div>
        <div className="dean-oversight__attention">{data.attention.map(item => <article key={item.key}><div><strong>{item.student_count}</strong><h3>{item.label}</h3><small>{item.student_count === 1 ? 'student' : 'students'} requiring follow-up</small></div><button className="dean-oversight__button" disabled={!item.student_count} onClick={() => openDetails(item.key, item.label)}>View details</button></article>)}</div>
        <p className="dean-oversight__footnote">A student may appear in more than one attention category. Requirements use the existing deployment checklist; company confirmation follows a student completion request.</p>
      </section>
    </>}
    <dialog className="dean-oversight__dialog" ref={dialog} aria-labelledby="dean-detail-title" onCancel={event => { event.preventDefault(); closeDetails() }}>
      <div className="dean-oversight__dialog-header"><div><span className="dean-oversight__eyebrow">READ-ONLY DETAILS</span><h2 id="dean-detail-title">{data?.attention.find(item => item.key === selection?.category)?.label ?? selection?.title}</h2><p>{term && termLabel(term)}{selection?.coordinator && ` · ${data?.workloads.find(item => item.coordinator_id === selection.coordinator)?.coordinator_name ?? "Coordinator"}`}</p></div><button className="dean-oversight__button" autoFocus onClick={closeDetails}>Close</button></div>
      {selection && <label className="dean-oversight__filter">Attention category<select value={selection.category} onChange={event => { setPage(1); setDetails(null); setSelection({ ...selection, category: event.target.value as AttentionCategory }) }}>{data?.attention.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>}
      {detailError && <p role="alert">{detailError} <button onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
      {!details && !detailError && <p role="status">Loading details…</p>}
      {details && <><p>{details.total} {details.total === 1 ? 'student' : 'students'} · Names and status only; no grades or document contents.</p><div className="dean-oversight__detail-list">{details.items.map(item => <article key={item.student_id}><h3>{item.student_name}</h3><p>{item.student_number || 'No student number'} · {item.stage}</p><p>Coordinator: {item.coordinator_name}<br />Company: {item.company_name || 'No company placement'}</p><ul>{item.details.map(detail => <li key={detail}>{detail}</li>)}</ul></article>)}{!details.items.length && <p>No students match this category and coordinator.</p>}</div><div className="dean-oversight__pagination"><button className="dean-oversight__button" disabled={page <= 1} onClick={() => { setDetails(null); setPage(value => value - 1) }}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(details.total / details.limit))}</span><button className="dean-oversight__button" disabled={page * details.limit >= details.total} onClick={() => { setDetails(null); setPage(value => value + 1) }}>Next</button></div></>}
    </dialog>
  </div>
}
