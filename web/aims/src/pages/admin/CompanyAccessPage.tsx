import { useEffect, useRef, useState, type FormEvent } from 'react'
import { companyAccessService, type CompanyAccessCompany, type CompanyAccessLink, type CompanyAccessOptions, type CompanyAccessPageData, type CompanySupervisor } from '../../services/companyAccessService'
import { notificationChanged } from '../../hooks/useNotificationCount'
import './company-access.css'

type Decision = { kind: 'grant'; supervisor: CompanySupervisor; company: CompanyAccessCompany } | { kind: 'remove'; link: CompanyAccessLink }
function useDebounced(value: string) {
  const [result, setResult] = useState(value)
  useEffect(() => { const timer = window.setTimeout(() => setResult(value), 300); return () => window.clearTimeout(timer) }, [value])
  return result
}
const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Could not update company access. Please retry.'

export function CompanyAccessPage({ onManageAccounts }: { onManageAccounts: () => void }) {
  const [data, setData] = useState<CompanyAccessPageData | null>(null)
  const [options, setOptions] = useState<CompanyAccessOptions | null>(null)
  const [supervisorSearch, setSupervisorSearch] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [error, setError] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [success, setSuccess] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const listSearch = useDebounced(search)
  const userSearch = useDebounced(supervisorSearch)
  const partnerSearch = useDebounced(companySearch)

  useEffect(() => {
    const controller = new AbortController()
    companyAccessService.list(listSearch, status, page, controller.signal).then(result => {
      if (!controller.signal.aborted) { setData(result); setError(''); setLoading(false) }
    }).catch(reason => { if (!controller.signal.aborted) { setError(message(reason)); setLoading(false) } })
    return () => controller.abort()
  }, [listSearch, status, page, refresh])
  useEffect(() => {
    const controller = new AbortController()
    companyAccessService.options(userSearch, partnerSearch, controller.signal).then(result => {
      if (!controller.signal.aborted) { setOptions(result); setOptionsError(''); setOptionsLoading(false) }
    }).catch(reason => { if (!controller.signal.aborted) { setOptionsError(message(reason)); setOptionsLoading(false) } })
    return () => controller.abort()
  }, [userSearch, partnerSearch, refresh])
  useEffect(() => {
    if (decision && !dialog.current?.open) dialog.current?.showModal()
    if (!decision && dialog.current?.open) dialog.current.close()
  }, [decision])

  function reload() { setLoading(true); setOptionsLoading(true); setRefresh(value => value + 1) }
  function confirm(next: Decision) { setActionError(''); setSuccess(''); setDecision(next) }
  function submit(event: FormEvent) {
    event.preventDefault()
    const supervisor = options?.supervisors.find(item => item.id === supervisorId)
    const company = options?.companies.find(item => item.id === companyId)
    if (supervisor && company) confirm({ kind: 'grant', supervisor, company })
  }
  async function perform() {
    if (!decision || busy) return
    const target = decision
    setBusy(true); setActionError('')
    try {
      const result = target.kind === 'grant'
        ? await companyAccessService.grant(target.supervisor.id, target.company.id)
        : await companyAccessService.remove(target.link.id)
      const identity = `${result.link.supervisor.name} · ${result.link.company.name}`
      setSuccess(result.action === 'unchanged' ? `Access was already ${result.link.is_active ? 'active' : 'removed'} for ${identity}.`
        : `${result.action === 'removed' ? 'Removed company access' : result.action === 'reactivated' ? 'Restored company access' : 'Company access linked'}: ${identity}.`)
      setDecision(null)
      if (target.kind === 'grant') { setSupervisorId(''); setCompanyId('') }
      reload()
      notificationChanged()
    } catch (reason) { setActionError(message(reason)) }
    finally { setBusy(false) }
  }
  const selectedSupervisor = options?.supervisors.find(item => item.id === supervisorId)
  const selectedCompany = options?.companies.find(item => item.id === companyId)
  const optionsPending = optionsLoading || userSearch !== supervisorSearch || partnerSearch !== companySearch
  const tablePending = loading || listSearch !== search
  const targetSupervisor = decision?.kind === 'grant' ? decision.supervisor : decision?.link.supervisor
  const targetCompany = decision?.kind === 'grant' ? decision.company : decision?.link.company

  return <section className="workspace-page company-access">
    <header className="workspace-page-heading company-access-heading"><div><span className="stake-kicker">ADMINISTRATION · COMPANY ACCOUNTS</span><h1>Company access</h1><p>Link each authorized company representative to the company records they can access.</p></div><button type="button" className="outline-button" onClick={onManageAccounts}>Manage company accounts</button></header>
    <div className="company-access-stats" aria-label="Company access totals"><article><small>Active company links</small><strong>{data?.stats.active ?? '—'}</strong></article><article><small>Supervisor accounts with active links</small><strong>{data?.stats.supervisors ?? '—'}</strong></article><article><small>Removed company links</small><strong>{data?.stats.inactive ?? '—'}</strong></article></div>
    <p className="company-access-muted">Totals cover all company links, across academic terms.</p>
    {success && <p className="company-access-success" role="status">{success}</p>}
    <section className="panel company-access-panel" aria-labelledby="company-access-create"><h2 id="company-access-create">Assign a representative</h2><p>Select an active Company Supervisor account and an active company. Account creation is available under Users; company registration and MOA records are maintained by the Career Center.</p>
      {optionsError && <p className="company-access-error" role="alert">{optionsError} <button type="button" onClick={reload}>Retry</button></p>}
      <form onSubmit={submit}><div className="company-access-form-grid"><fieldset><legend>1 · Company supervisor</legend><label>Find an account<input type="search" maxLength={120} value={supervisorSearch} placeholder="Name or account email" onChange={event => { setSupervisorSearch(event.target.value); setSupervisorId(''); setOptionsLoading(true) }} /></label><label>Company Supervisor account<select required value={supervisorId} disabled={optionsPending || !!optionsError} onChange={event => setSupervisorId(event.target.value)}><option value="">{optionsPending ? 'Loading accounts…' : 'Select an account'}</option>{options?.supervisors.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label>{options && <small>{options.supervisors.length} of {options.supervisor_total} matching active accounts. {options.supervisor_total > options.limit ? 'Refine the search to find your account.' : ''}</small>}{!optionsPending && !optionsError && !options?.supervisors.length && <p>No matching active Company Supervisor accounts. Create or activate the account in Users first.</p>}</fieldset>
        <fieldset><legend>2 · Company record</legend><label>Find a company<input type="search" maxLength={120} value={companySearch} placeholder="Registered company name" onChange={event => { setCompanySearch(event.target.value); setCompanyId(''); setOptionsLoading(true) }} /></label><label>Company<select required value={companyId} disabled={optionsPending || !!optionsError} onChange={event => setCompanyId(event.target.value)}><option value="">{optionsPending ? 'Loading companies…' : 'Select a company'}</option>{options?.companies.map(company => <option key={company.id} value={company.id}>{company.name}{company.moa_ready ? ' · MOA ready' : ' · MOA needs review'}</option>)}</select></label>{options && <small>{options.companies.length} of {options.company_total} matching active companies. {options.company_total > options.limit ? 'Refine the search to find your company.' : ''}</small>}{!optionsPending && !optionsError && !options?.companies.length && <p>No matching active company records. Coordinate registration with the Career Center.</p>}</fieldset></div>
        {selectedCompany && <p className={`company-access-note${selectedCompany.moa_ready ? '' : ' needs-review'}`}>{selectedCompany.name} · {selectedCompany.moa_ready ? 'MOA requirements are recorded and current.' : 'MOA clearance needs Career Center review before internship placement can proceed.'}</p>}
        <div className="company-access-form-actions"><p>Assign only companies this person is authorized to represent. One representative may be linked to more than one company.</p><button type="submit" className="primary-button" disabled={busy || optionsPending || !!optionsError || !selectedSupervisor || !selectedCompany}>Review link</button></div>
      </form>
      <p className="company-access-footnote">Company access allows the representative to see that company’s applications and interns. MOA clearance, student acceptance and official deployment retain their existing approvals.</p>
    </section>
    <section className="panel company-access-panel" aria-labelledby="company-access-roster"><div className="company-access-section-heading"><div><h2 id="company-access-roster">Representative assignments</h2><p>Remove a link to withdraw access to that company while preserving internship records. Restoring access requires an active Company Supervisor account and an active company.</p></div><button className="outline-button" onClick={reload} disabled={busy}>Refresh</button></div>
      <div className="company-access-filters"><label>Search assignments<input type="search" value={search} maxLength={120} placeholder="Supervisor, email or company" onChange={event => { setSearch(event.target.value); setPage(1); setLoading(true) }} /></label><label>Link status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); setLoading(true) }}><option value="all">All links</option><option value="active">Active links</option><option value="inactive">Removed links</option></select></label></div>
      {error && <p className="company-access-error" role="alert">{error} <button type="button" onClick={reload}>Retry</button></p>}
      <div className="company-access-table-wrap" aria-busy={tablePending}><table><caption className="company-access-sr-only">Company-supervisor access assignments</caption><thead><tr><th scope="col">Representative</th><th scope="col">Company</th><th scope="col">Access link</th><th scope="col">Original link date</th><th scope="col">Action</th></tr></thead><tbody>
        {tablePending ? <tr><td colSpan={5}>Loading company access…</td></tr> : error ? <tr><td colSpan={5}>Assignments could not be loaded. Please retry.</td></tr> : data?.items.map(link => <tr key={link.id}><td><strong>{link.supervisor.name}</strong><small>{link.supervisor.email}</small>{!link.supervisor.is_active && <small className="company-access-warning">Account inactive</small>}{!link.supervisor.is_company_supervisor && <small className="company-access-warning">Account no longer has the Company Supervisor role</small>}</td><td><strong>{link.company.name}</strong><small>{link.company.moa_ready ? 'MOA ready' : 'MOA needs review'}{!link.company.is_active ? ' · Company inactive' : ''}</small></td><td><span className={`company-access-status${link.is_active ? ' is-active' : ''}`}>{link.is_active ? 'Active' : 'Removed'}</span></td><td>{link.created_at ? new Date(link.created_at).toLocaleDateString() : 'Not recorded'}</td><td>{link.is_active ? <button type="button" className="company-access-remove" disabled={busy} onClick={() => confirm({ kind: 'remove', link })}>Remove access</button> : <button type="button" className="outline-button" disabled={busy || !link.supervisor.is_active || !link.company.is_active || !link.supervisor.is_company_supervisor} onClick={() => confirm({ kind: 'grant', supervisor: link.supervisor, company: link.company })}>Restore access</button>}</td></tr>)}
        {!tablePending && !error && !data?.items.length && <tr><td colSpan={5}>No assignments match this view. Select an account and company above to create a link.</td></tr>}
      </tbody></table></div>
      <footer className="company-access-pagination"><span>{data?.total ?? 0} matching links · Page {page} of {data?.total_pages ?? 1}</span><div><button className="outline-button" disabled={tablePending || page <= 1} onClick={() => { setPage(value => value - 1); setLoading(true) }}>Previous</button><button className="outline-button" disabled={tablePending || !data || page >= data.total_pages} onClick={() => { setPage(value => value + 1); setLoading(true) }}>Next</button></div></footer>
    </section>
    <dialog ref={dialog} className="company-access-dialog" aria-labelledby="company-access-decision" onCancel={event => { event.preventDefault(); if (!busy) setDecision(null) }}><h2 id="company-access-decision">{decision?.kind === 'remove' ? 'Remove company access?' : 'Link this representative?'}</h2><p>Review the exact account and company before confirming.</p><dl><dt>Representative</dt><dd>{targetSupervisor?.name}<small>{targetSupervisor?.email}</small></dd><dt>Company</dt><dd>{targetCompany?.name}</dd></dl><p>{decision?.kind === 'remove' ? 'This removes the representative’s access to this company on their next request. Their account and other company assignments stay available. Student and internship records are preserved.' : 'This representative will be able to access this company’s applications and intern-monitoring records. Confirm that this person is authorized to represent the selected company.'}</p>{actionError && <p className="company-access-error" role="alert">{actionError}</p>}<div><button className="outline-button" autoFocus disabled={busy} onClick={() => setDecision(null)}>Cancel</button><button className={decision?.kind === 'remove' ? 'company-access-remove' : 'primary-button'} disabled={busy} onClick={() => void perform()}>{busy ? 'Saving…' : decision?.kind === 'remove' ? 'Confirm removal' : 'Confirm link'}</button></div></dialog>
  </section>
}
