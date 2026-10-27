import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../components/Icons'
import { directPlacementService as service } from '../../services/directPlacementService'
import type { DirectPlacement, DirectProposal, PlacementOptions } from '../../services/directPlacementService'
import type { UserRole } from '../../types/auth'
import './direct-placements.css'

const blank = (): DirectProposal => ({ student_id: '', company_id: null, company_name: null, contact_person: null, contact_email: null, position: '', reason: '' })
const human = (text: string) => text.replace(/_/g, ' ')
function stage(p: DirectPlacement) {
  if (!['pending','released'].includes(p.status)) return human(p.status)
  if (p.deployment?.status === 'deployed') return 'Officially deployed'
  if (p.deployment?.status === 'completed') return 'Internship completed'
  if (!p.coordinator_ready) return 'Assignment needs review'
  if (!p.partnership_ready) return p.partnership_status === 'returned' ? 'Partnership returned' : 'Pending partnership review'
  if (p.student_decision !== 'acknowledged') return 'Awaiting student acknowledgement'
  if (p.application_status === 'accepted') return 'Pre-deployment requirements'
  return 'Awaiting company decision'
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export function DirectPlacementsPage({ role }: { role: UserRole }) {
  const [result, setResult] = useState<{ items: DirectPlacement[]; total: number; limit: number } | null>(null)
  const [selected, setSelected] = useState<DirectPlacement | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0)
  const [options, setOptions] = useState<PlacementOptions | null>(null), [studentSearch, setStudentSearch] = useState(''), [companySearch, setCompanySearch] = useState('')
  const [creating, setCreating] = useState(false), [draft, setDraft] = useState(blank), [newCompany, setNewCompany] = useState(false)
  const [notes, setNotes] = useState(''), [linkedCompany, setLinkedCompany] = useState(''), [cancelReason, setCancelReason] = useState(''), [deploymentDate, setDeploymentDate] = useState(today)
  const sequence = useRef(0), editor = useRef<HTMLDivElement>(null)
  const canPropose = role === 'coordinator' || role === 'dean'
  useEffect(() => {
    const controller = new AbortController(); setLoading(true)
    service.list(page, controller.signal).then(setResult).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, revision])
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { service.options(studentSearch, companySearch, controller.signal).then(setOptions).catch(e => { if (!controller.signal.aborted) setError(e.message) }) }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [studentSearch, companySearch, revision])
  async function select(id: string) {
    const request = ++sequence.current; setError(''); setNotes(''); setCancelReason('')
    try { const data = await service.detail(id); if (request === sequence.current) { setSelected(data); setLinkedCompany(data.company_id ?? '') } }
    catch (e) { if (request === sequence.current) setError(e instanceof Error ? e.message : 'Could not load placement') }
  }
  async function act(operation: () => Promise<unknown>, message: string) {
    if (busy) return; setBusy(true); setError(''); setNotice('')
    try { await operation(); setNotice(message); setRevision(v => v + 1); if (selected) await select(selected.id) }
    catch (e) { setError(e instanceof Error ? e.message : 'The request could not be saved') }
    finally { setBusy(false) }
  }
  async function propose(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('')
    try {
      const created = await service.propose({ ...draft, company_id: newCompany ? null : draft.company_id, company_name: newCompany ? draft.company_name : null })
      ++sequence.current; setSelected(created); setLinkedCompany(created.company_id ?? ''); setCreating(false); setDraft(blank()); setPage(1); setRevision(v => v + 1)
      setNotice('Proposal recorded. The student can review it in mobile. Partnership and acceptance checks still apply.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the proposal') }
    finally { setBusy(false) }
  }
  const active = selected && ['pending','released'].includes(selected.status)
  const started = selected?.deployment && ['deployed','completed'].includes(selected.deployment.status)
  const readyToConfirm = role === 'coordinator' && active && !started && selected?.coordinator_ready && selected?.partnership_ready && selected?.application_status === 'accepted' && selected?.deployment?.checklist?.ready_for_deployment
  const canClear = selected?.company_id ? selected.moa.ready : options?.companies.find(c => c.id === linkedCompany)?.moa_ready
  return <div className="dp-workspace">
    <header className="dp-hero"><div><span className="dp-kicker">CITC · SCHOOL-ARRANGED INTERNSHIPS</span><h1>{role === 'career_center' ? 'Partnership review.' : 'Direct company placement.'}</h1><p>{role === 'career_center' ? 'Verify company records and MOA readiness before proposed placements move forward.' : 'Arrange placements through direct coordination while keeping student acknowledgement, company acceptance and school approval accountable.'}</p></div><Icon name="briefcase" size={42} /></header>
    <div className="dp-toolbar"><div><h2>{role === 'career_center' ? 'Placement review queue' : 'Placement proposals'}</h2><p>{options ? `${options.academic_year} · Semester ${options.semester}` : 'Current academic term'} · {result?.total ?? 0} records</p></div>{canPropose && <button className="dp-primary" disabled={busy || !options?.can_propose} onClick={() => { setCreating(true); setError(''); window.setTimeout(() => editor.current?.querySelector<HTMLInputElement>('input')?.focus(), 0) }}>Propose a placement<Icon name="arrow" size={16} /></button>}</div>
    <div className="dp-toolbar"><span className="dp-muted">{canPropose && options && !options.can_propose ? 'An active current-term designation and eligible assignment scope are required to propose placements.' : 'Previous records stay in the decision history.'}</span><button className="dp-secondary" disabled={busy || loading} onClick={() => { setError(''); setRevision(v => v + 1); if (selected) void select(selected.id) }}>Refresh</button></div>
    {error && <p className="dp-error" role="alert">{error}</p>}{notice && <p className="dp-notice" role="status">{notice}</p>}
    {creating && <section className="dp-card dp-editor" ref={editor}><div className="dp-toolbar"><h2>New direct placement</h2><button className="dp-secondary" disabled={busy} onClick={() => setCreating(false)}>Cancel</button></div><p className="dp-muted">Choose a student in your assignment scope. Resolve existing applications first. This action does not approve deployment.</p><form onSubmit={propose} className="dp-form">
      <div className="dp-two"><label>Find student<input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Name or student number" maxLength={100} /><small>First 100 matches in your current assignment scope.</small></label><label>Student<select required value={draft.student_id} onChange={e => setDraft({ ...draft, student_id: e.target.value })}><option value="">Select a student</option>{options?.students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.student_number ?? 'No student number'}</option>)}</select></label></div>
      <label className="dp-checkbox"><input type="checkbox" checked={newCompany} onChange={e => { setNewCompany(e.target.checked); setDraft({ ...draft, company_id: null, company_name: null }) }} />The company is not registered in AIMS yet</label>
      {newCompany ? <div className="dp-info"><p>Career Center will register and verify this company. A signed, current MOA is required before the placement can reach the company.</p><label>Proposed company legal name<input required minLength={2} maxLength={255} value={draft.company_name ?? ''} onChange={e => setDraft({ ...draft, company_name: e.target.value })} /></label></div> : <div className="dp-two"><label>Find company<input maxLength={100} value={companySearch} onChange={e => setCompanySearch(e.target.value)} placeholder="Company name" /></label><label>Partner company<select required value={draft.company_id ?? ''} onChange={e => setDraft({ ...draft, company_id: e.target.value || null })}><option value="">Select a company</option>{options?.companies.map(c => <option key={c.id} value={c.id}>{c.name} · {c.moa_ready ? 'Current MOA' : 'Needs partnership review'}</option>)}</select></label></div>}
      <div className="dp-two"><label>Company contact person <small>Optional business contact</small><input maxLength={100} value={draft.contact_person ?? ''} onChange={e => setDraft({ ...draft, contact_person: e.target.value || null })} /></label><label>Company contact email<input type="email" value={draft.contact_email ?? ''} onChange={e => setDraft({ ...draft, contact_email: e.target.value || null })} /></label></div>
      <label>Internship position<input required minLength={3} maxLength={255} value={draft.position} onChange={e => setDraft({ ...draft, position: e.target.value })} /></label><label>Reason and arrangement details<textarea required minLength={15} maxLength={2000} rows={4} placeholder="Record the company's request, why this placement is suitable, and any coordination details." value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} /></label><button className="dp-primary" disabled={busy}>{busy ? 'Saving…' : 'Record placement proposal'}</button>
    </form></section>}
    <div className="dp-columns"><section className="dp-card"><h2>Current-term requests</h2>{loading ? <p className="dp-muted">Loading placements…</p> : !result?.items.length ? <div className="dp-empty"><Icon name="briefcase" size={28} /><p>No direct placements yet.</p><small>Normal student applications remain available.</small></div> : result.items.map(p => <button className={`dp-row${selected?.id === p.id ? ' dp-row--selected' : ''}`} key={p.id} onClick={() => void select(p.id)} disabled={busy}><strong>{p.student_name}</strong><span>{p.company_name} · {p.position}</span><small>{stage(p)}</small></button>)}<nav className="dp-pagination" aria-label="Direct placement pages"><button className="dp-secondary" disabled={page <= 1 || loading} onClick={() => setPage(v => v - 1)}>Previous</button><span>Page {page}</span><button className="dp-secondary" disabled={!result || page * result.limit >= result.total || loading} onClick={() => setPage(v => v + 1)}>Next</button></nav></section>
      <section className="dp-card dp-detail" aria-live="polite">{!selected ? <div className="dp-empty"><Icon name="users" size={30} /><h2>Select a proposal</h2><p>Review its partnership checks, acknowledgement and decision history here.</p></div> : <><span className="dp-stage">{stage(selected)}</span><h2>{selected.student_name}</h2><p className="dp-muted">{selected.student_number ?? 'No student number'} · {selected.company_name}</p><h3>{selected.position}</h3><p className="dp-reason">{selected.reason}</p>{(selected.contact_person || selected.contact_email) && <p className="dp-muted">Business contact: {selected.contact_person} {selected.contact_email}</p>}
        <div className="dp-checks">{[{ label: 'Partnership cleared', passed: selected.partnership_ready }, { label: 'Student acknowledged', passed: selected.student_decision === 'acknowledged' }, { label: 'Company accepted', passed: selected.application_status === 'accepted' }, { label: 'Official deployment', passed: !!started }].map(check => <div key={check.label}><span className={check.passed ? 'dp-check dp-check--passed' : 'dp-check'}><Icon name={check.passed ? 'check' : 'clock'} size={15} /></span><span>{check.label}</span></div>)}</div>
        {!selected.coordinator_ready && active && <p className="dp-error">Coordinator assignment or designation needs reconciliation before this proposal can proceed.</p>}
        {!selected.partnership_ready && active && <p className="dp-info">Partnership review is pending or needs revalidation. No deployment or clock-in is authorized by this proposal.</p>}
        {selected.partnership_notes && <p className="dp-info"><strong>Career Center notes</strong><br />{selected.partnership_notes}</p>}
        <details className="dp-moa"><summary>MOA readiness checks</summary>{selected.moa.checks.map(check => <p key={check.label}><Icon name={check.passed ? 'check' : 'clock'} size={14} />{check.label}</p>)}</details>
        {role === 'career_center' && active && !started && <form className="dp-form dp-action" onSubmit={e => { e.preventDefault(); void act(() => service.review(selected.id, 'clear', selected.company_id || linkedCompany || null, notes), 'Partnership clearance recorded.') }}><h3>Partnership decision</h3><p className="dp-muted">Update the verified company and signed MOA dates in <a href="/career-center/companies">Companies</a> first. Clearance cannot bypass missing or expired agreements.</p>{!selected.company_id && <><label>Find registered company<input value={companySearch} maxLength={100} onChange={e => setCompanySearch(e.target.value)} /></label><label>Link matching legal company<select required value={linkedCompany} onChange={e => setLinkedCompany(e.target.value)}><option value="">Choose matching company</option>{options?.companies.map(c => <option key={c.id} value={c.id}>{c.name} · {c.moa_ready ? 'Current MOA' : 'Needs MOA'}</option>)}</select></label></>}
          <label>Review notes<textarea required minLength={15} maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label><div className="dp-actions"><button className="dp-primary" disabled={busy || !canClear}>Clear partnership</button><button className="dp-secondary" type="button" disabled={busy || notes.trim().length < 15} onClick={() => void act(() => service.review(selected.id, 'return', null, notes), 'Proposal returned for clarification.')}>Return for clarification</button></div></form>}
        {role === 'coordinator' && active && !started && selected.application_status === 'accepted' && selected.deployment && <form className="dp-form dp-action" onSubmit={e => { e.preventDefault(); if (selected.deployment) void act(() => service.confirm(selected.deployment!.id, deploymentDate), 'Official deployment confirmed.') }}><h3>Academic deployment approval</h3>{selected.deployment.checklist?.items.map(item => <p className="dp-muted" key={item.label}>{item.label}: {human(item.status)}</p>)}<label>Deployment date<input type="date" required max={today()} value={deploymentDate} onChange={e => setDeploymentDate(e.target.value)} /></label><p className="dp-muted">Required documents must be verified. The server rechecks partnership, acknowledgement and company acceptance.</p><button className="dp-primary" disabled={busy || !readyToConfirm}>Confirm official deployment</button></form>}
        {canPropose && active && !started && <details className="dp-cancel"><summary>Cancel this proposal</summary><form className="dp-form" onSubmit={e => { e.preventDefault(); void act(() => service.cancel(selected.id, cancelReason), 'Proposal cancelled. Previous decisions remain in history.') }}><p className="dp-muted">This closes the proposal and any linked pre-deployment record. It cannot transfer a started internship.</p><label>Cancellation reason<textarea required minLength={15} maxLength={2000} rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} /></label><button className="dp-secondary" disabled={busy}>Confirm cancellation</button></form></details>}
        <section className="dp-history"><h3>Decision history</h3>{selected.history?.map(event => <article key={event.id}><strong>{human(event.action)}</strong><small>{event.actor_name} · {new Date(event.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</small>{typeof event.details.reason === 'string' && <p>{event.details.reason}</p>}{typeof event.details.notes === 'string' && <p>{event.details.notes}</p>}</article>)}</section>
      </>}</section>
    </div>
  </div>
}
