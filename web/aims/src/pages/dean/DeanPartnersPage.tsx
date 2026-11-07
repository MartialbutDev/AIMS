import { MoaFiles } from '../../components/MoaFiles'
import { useEffect, useRef, useState } from 'react'
import { getDeanPartners, type DeanPartner, type MoaStatus } from '../../services/deanPartnersService'
import './dean-partners.css'

const labels: Record<MoaStatus, string> = { current: 'Current MOA', expiring: 'Expires within 30 days', expired: 'Expired', unsigned: 'Unsigned', upcoming: 'Not yet effective', incomplete: 'Incomplete record', inactive: 'Inactive company' }
const date = (value: string | null) => value ? new Date(`${value}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded'
function website(value: string | null) {
  if (!value) return null
  try { const url = new URL(value.includes('://') ? value : `https://${value}`); return ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null }
}
export function DeanPartnersPage() {
  const [data, setData] = useState<{ items: DeanPartner[]; asOf: string } | null>(null)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0)
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('active'), [page, setPage] = useState(1)
  const [selected, setSelected] = useState<DeanPartner | null>(null)
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getDeanPartners(controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setError(''); setLoading(false) } })
      .catch(reason => { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : 'Could not load partners.'); setLoading(false) } })
    return () => controller.abort()
  }, [revision])
  useEffect(() => { if (selected && !dialog.current?.open) dialog.current?.showModal() }, [selected])
  function close() { dialog.current?.close(); setSelected(null); trigger.current?.focus() }
  function refresh() { close(); setData(null); setLoading(true); setError(''); setPage(1); setRevision(value => value + 1) }
  const companies = data?.items ?? []
  const query = search.trim().toLowerCase()
  const matches = companies.filter(company => (filter === 'all' || (filter === 'active' ? company.is_active : company.moa_status === filter)) &&
    [company.name, company.industry, company.address, company.moa_reference, company.contact_person].some(value => value?.toLowerCase().includes(query)))
  const pages = Math.max(1, Math.ceil(matches.length / 12)), currentPage = Math.min(page, pages)
  const visible = matches.slice((currentPage - 1) * 12, currentPage * 12)
  const cards = [
    ['Active companies', companies.filter(c => c.is_active).length],
    ['Placement-ready MOAs', companies.filter(c => c.moa_ready).length],
    ['Expiring within 30 days', companies.filter(c => c.moa_status === 'expiring').length],
    ['Expired MOAs', companies.filter(c => c.moa_status === 'expired').length],
  ] as const
  return <div className="dean-partners">
    <header className="dean-partners__hero"><div><span>CITC · DEAN’S OFFICE</span><h1>Industry & MOA partners</h1><p>Know which partnerships are ready for student placement and which need attention.</p></div><strong>Read-only directory</strong></header>
    <section className="dean-partners__metrics" aria-label="Partnership overview">{cards.map(([label, count]) => <article key={label}><span>{label}</span><strong>{loading || error ? '—' : count}</strong></article>)}</section>
    <section className="dean-partners__panel">
      <div className="dean-partners__heading"><div><h2>Partnership directory</h2><p>Agreement records are maintained by the Career Center and administrator.{data && ` Status as of ${date(data.asOf)} (Philippine time).`}</p></div><button onClick={refresh} disabled={loading}>Refresh</button></div>
      <div className="dean-partners__filters"><label>Search partners<input type="search" value={search} placeholder="Company, industry, address or MOA reference" onChange={event => { setSearch(event.target.value); setPage(1) }} /></label><label>MOA status<select value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }}><option value="active">Active companies</option><option value="all">All records</option>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      {loading ? <p role="status">Loading partnership records…</p> : error ? <div role="alert" className="dean-partners__notice">{error} Use Refresh to try again.</div> : <>
        <p className="dean-partners__caption" role="status">{matches.length} matching {matches.length === 1 ? 'company' : 'companies'} · Overview counts cover all records.</p>
        {visible.length === 0 ? <div className="dean-partners__notice">{companies.length ? 'No partners match these filters. Try another search or status.' : 'No company records yet. The Career Center can register internship partners.'}</div> : <div className="dean-partners__table"><table><thead><tr><th>Company / industry</th><th>MOA standing</th><th>Reference</th><th>Effective period</th><th>Details</th></tr></thead><tbody>{visible.map(company => <tr key={company.id}><td><strong>{company.name}</strong><small>{company.industry || 'Industry not recorded'}</small></td><td><span className={`dean-partners__status dean-partners__status--${company.moa_status}`}>{labels[company.moa_status]}</span><small>{company.moa_ready ? 'Eligible partnership for placement' : 'Partnership not ready for placement'}</small></td><td>{company.moa_reference || 'Not recorded'}</td><td>{date(company.moa_effective_at)}<small>to {date(company.moa_expires_at)}</small></td><td><button aria-label={`View ${company.name}`} onClick={event => { trigger.current = event.currentTarget; setSelected(company) }}>View details</button></td></tr>)}</tbody></table></div>}
        {matches.length > 12 && <nav className="dean-partners__pagination" aria-label="Directory pages"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
      </>}
    </section>
    <dialog ref={dialog} className="dean-partners__dialog" aria-labelledby="partner-title" onCancel={event => { event.preventDefault(); close() }} onClose={() => { setSelected(null); trigger.current?.focus() }}>
      {selected && <><div className="dean-partners__heading"><div><span className={`dean-partners__status dean-partners__status--${selected.moa_status}`}>{labels[selected.moa_status]}</span><h2 id="partner-title">{selected.name}</h2></div><button autoFocus onClick={close}>Close</button></div>
        {selected.description && <p>{selected.description}</p>}
        <dl>{[['Industry', selected.industry], ['Address', selected.address], ['Contact person', selected.contact_person], ['Contact email', selected.contact_email], ['Contact phone', selected.contact_phone], ['MOA reference', selected.moa_reference], ['Date signed', date(selected.moa_signed_at)], ['Effective from', date(selected.moa_effective_at)], ['Expires on', date(selected.moa_expires_at)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
        {website(selected.website) && <a href={website(selected.website)!} target="_blank" rel="noopener noreferrer">Visit company website ↗</a>}
        <h3>Partnership readiness</h3><ul>{selected.checks.map(check => <li key={check.label}><span>{check.passed ? '✓ Met' : 'Needs attention'}</span> {check.label}</li>)}</ul>
        <p className="dean-partners__notice">{selected.moa_ready ? 'This partnership meets the recorded MOA checks. Student requirements and deployment approval are still required.' : 'Contact the Career Center to review this partnership record before placement.'}</p>
        <MoaFiles key={selected.id} companyId={selected.id} />
      </>}
    </dialog>
  </div>
}
