import { IntakeAvailability } from '../../components/CompanyIntakePanel'
import { MoaFiles } from '../../components/MoaFiles'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icons'
import {
  createCareerCompany,
  exportCareerCompanies,
  getCareerCompanies,
  updateCareerCompany,
  type CareerCompany,
  type CareerCompanyPayload,
} from '../../services/careerCenterService'
import { daysUntilMoaExpiry, formatMoaDate as formatDate, getMoaStatus, moaDaysLeftLabel, MOA_EXPIRING_WITHIN_DAYS, type MoaExpiryStatus } from '../../services/moaExpiry'
import './career-center-ui.css'

interface CompaniesPageProps {
  onNavigate: (section: string) => void
}

type DialogMode = 'create' | 'edit' | 'view' | null
type CompanyFilter =
  | 'all'
  | 'signed'
  | 'expiring'
  | 'expired'
  | 'pending'
  | 'inactive'

type CompanyForm = {
  intern_capacity: string
  intake_version: number
  accepting_interns: boolean
  name: string
  address: string
  contact_person: string
  contact_phone: string
  industry: string
  website: string
  ustp_coverage: string
  nature_of_partnership: string
  moa_notarized_at: string
  moa_notarized_year: string
  moa_effectivity_years: string
  is_active: boolean
  is_moa_signed: boolean
  moa_reference: string
  moa_signed_at: string
  moa_effective_at: string
  moa_expires_at: string
}

const emptyForm: CompanyForm = {
  intern_capacity: '',
  intake_version: 0,
  accepting_interns: true,
  name: '',
  address: '',
  contact_person: '',
  contact_phone: '',
  industry: '',
  website: '',
  ustp_coverage: '',
  nature_of_partnership: '',
  moa_notarized_at: '',
  moa_notarized_year: '',
  moa_effectivity_years: '',
  is_active: true,
  is_moa_signed: false,
  moa_reference: '',
  moa_signed_at: '',
  moa_effective_at: '',
  moa_expires_at: '',
}

function statusLabel(status: MoaExpiryStatus): string {
  switch (status) {
    case 'signed':
      return 'Signed'
    case 'expiring':
      return 'Expiring soon'
    case 'expired':
      return 'Expired'
    default:
      return 'Not signed'
  }
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function companyToForm(company: CareerCompany): CompanyForm {
  return {
    intern_capacity: company.intake?.capacity == null ? "" : String(company.intake.capacity),
    intake_version: company.intake?.version || 0,
    accepting_interns: company.intake?.capacity == null ? true : company.intake.accepting,
    name: company.name,
    address: company.address ?? '',
    contact_person: company.contact_person ?? '',
    contact_phone: company.contact_phone ?? '',
    industry: company.industry ?? '',
    website: company.website ?? '',
    ustp_coverage: company.ustp_coverage ?? '',
    nature_of_partnership: company.nature_of_partnership ?? '',
    moa_notarized_at: company.moa_notarized_at ?? '',
    moa_notarized_year: company.moa_notarized_year?.toString() ?? '',
    moa_effectivity_years: company.moa_effectivity_years?.toString() ?? '',
    is_active: company.is_active,
    is_moa_signed: company.is_moa_signed,
    moa_reference: company.moa_reference ?? '',
    moa_signed_at: company.moa_signed_at ?? '',
    moa_effective_at: company.moa_effective_at ?? '',
    moa_expires_at: company.moa_expires_at ?? '',
  }
}

function toPayload(form: CompanyForm): CareerCompanyPayload {
  const nullable = (value: string) => value.trim() || null

  return {
    intern_capacity: Number(form.intern_capacity),
    intake_version: form.intake_version,
    name: form.name.trim(),
    address: nullable(form.address),
    contact_person: nullable(form.contact_person),
    contact_phone: nullable(form.contact_phone),
    industry: nullable(form.industry),
    website: nullable(form.website),
    ustp_coverage: nullable(form.ustp_coverage),
    nature_of_partnership: nullable(form.nature_of_partnership),
    moa_notarized_at: nullable(form.moa_notarized_at),
    moa_notarized_year: form.moa_notarized_year === '' ? null : Number(form.moa_notarized_year),
    moa_effectivity_years: form.moa_effectivity_years === '' ? null : Number(form.moa_effectivity_years),
    is_active: form.is_active,
    is_moa_signed: form.is_moa_signed,
    moa_reference: nullable(form.moa_reference),
    moa_signed_at: nullable(form.moa_signed_at),
    moa_effective_at: nullable(form.moa_effective_at),
    moa_expires_at: nullable(form.moa_expires_at),
  }
}

function CompanyBadge({ company }: { company: CareerCompany }) {
  const status = getMoaStatus(company)

  return (
    <span className={`cc-badge cc-badge--${status}`}>
      <span className="cc-badge-dot" />
      {statusLabel(status)}
    </span>
  )
}

function StatCard({
  label,
  value,
  detail,
  variant = 'default',
}: {
  label: string
  value: number
  detail: string
  variant?: string
}) {
  return (
    <article className={`cc-stat-card cc-stat-card--${variant}`}>
      <span className="cc-stat-label">{label}</span>
      <strong className="cc-stat-value">{value.toLocaleString()}</strong>
      <span className="cc-stat-detail">{detail}</span>
    </article>
  )
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
  max,
  maxLength,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  min?: number
  max?: number
  maxLength?: number
  required?: boolean
}) {
  return (
    <label className="cc-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        maxLength={maxLength}
        required={required}
      />
    </label>
  )
}

export function CompaniesPage({
  onNavigate,
}: CompaniesPageProps) {
  const [companies, setCompanies] = useState<CareerCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportPending = useRef(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CompanyFilter>('all')
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [selected, setSelected] = useState<CareerCompany | null>(null)
  const [form, setForm] = useState<CompanyForm>(emptyForm)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await getCareerCompanies()
        if (active) setCompanies(result)
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load company records.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [reloadKey])

  const stats = useMemo(() => {
    const active = companies.filter((company) => company.is_active)

    return {
      total: active.length,
      signed: active.filter(
        (company) => getMoaStatus(company) === 'signed'
      ).length,
      expiring: active.filter(
        (company) => getMoaStatus(company) === 'expiring'
      ).length,
      expired: active.filter(
        (company) => getMoaStatus(company) === 'expired'
      ).length,
      pending: active.filter(
        (company) => getMoaStatus(company) === 'pending'
      ).length,
    }
  }, [companies])

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase()

    return companies.filter((company) => {
      const matchesSearch = [
        company.name,
        company.industry,
        company.ustp_coverage,
        company.nature_of_partnership,
        company.contact_person,
        company.contact_email,
        company.address,
      ]
        .some((value) => (value ?? '').toLowerCase().includes(query))

      if (!matchesSearch) return false

      if (filter === 'inactive') return !company.is_active
      if (!company.is_active) return filter === 'all'
      if (filter === 'all') return true

      return getMoaStatus(company) === filter
    })
  }, [companies, search, filter])

  async function exportCompanies() {
    if (exportPending.current || loading || !filteredCompanies.length) return
    exportPending.current = true
    setExporting(true)
    setError('')
    try {
      await exportCareerCompanies(filteredCompanies.map(company => company.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export company records.')
    } finally {
      exportPending.current = false
      setExporting(false)
    }
  }

  const expiringCompanies = useMemo(
    () =>
      companies
        .filter(
          (company) =>
            company.is_active &&
            getMoaStatus(company) === 'expiring' &&
            company.moa_expires_at
        )
        .sort((a, b) =>
          (a.moa_expires_at ?? '').localeCompare(b.moa_expires_at ?? '')
        )
        .slice(0, 5),
    [companies]
  )

  function updateForm<K extends keyof CompanyForm>(
    key: K,
    value: CompanyForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function closeDialog() {
    if (saving) return
    setDialog(null)
    setSelected(null)
    setFormError('')
  }

  function openCreate() {
    setSelected(null)
    setForm({ ...emptyForm })
    setFormError('')
    setDialog('create')
  }

  function openEdit(company: CareerCompany) {
    setSelected(company)
    setForm(companyToForm(company))
    setFormError('')
    setDialog('edit')
  }

  function openView(company: CareerCompany) {
    setSelected(company)
    setDialog('view')
  }

  function refresh() {
    setSuccess('')
    setReloadKey((current) => current + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setFormError('')
    setSuccess('')

    if (!Number.isInteger(Number(form.intern_capacity)) || Number(form.intern_capacity) < 1 || Number(form.intern_capacity) > 100000) {
      setFormError('Enter the number of interns (1–100,000).')
      return
    }

    if (form.name.trim().length < 2) {
      setFormError('Company name must have at least two characters.')
      return
    }

    if (
      form.moa_effective_at &&
      form.moa_expires_at &&
      form.moa_expires_at < form.moa_effective_at
    ) {
      setFormError('MOA expiration cannot be before the effective date.')
      return
    }

    if (
      form.moa_signed_at &&
      form.moa_expires_at &&
      form.moa_expires_at < form.moa_signed_at
    ) {
      setFormError('MOA expiration cannot be before the signing date.')
      return
    }

    setSaving(true)

    try {
      const payload = toPayload(form)

      if (dialog === 'edit' && selected) {
        if (selected.intake) {
          payload.accepting_interns = form.accepting_interns
          payload.intake_academic_year = selected.intake.academic_year
          payload.intake_semester = selected.intake.semester
        }
        const updated = await updateCareerCompany(selected.id, payload)

        setCompanies((current) =>
          current.map((company) =>
            company.id === updated.id ? updated : company
          )
        )

        setSuccess('Company information updated successfully.')
      } else {
        const created = await createCareerCompany(payload)

        setCompanies((current) =>
          [...current, created].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        )

        setSuccess('Company registered successfully.')
      }

      setDialog(null)
      setSelected(null)
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to save company information.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(company: CareerCompany) {
    const action = company.is_active ? 'deactivate' : 'reactivate'

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${company.name}?`
      )
    ) {
      return
    }

    setError('')
    setSuccess('')

    try {
      const updated = await updateCareerCompany(company.id, {
        is_active: !company.is_active,
      })

      setCompanies((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item
        )
      )

      setSuccess(
        `Company ${updated.is_active ? 'reactivated' : 'deactivated'} successfully.`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update company status.'
      )
    }
  }

  return (
    <main className="cc-page">
      <header className="cc-page-header">
        <div>
          <h1>Company Management</h1>
          <p>
            Manage host training establishments, maintain company profiles,
            and monitor Memoranda of Agreement.
          </p>
        </div>

        <div className="cc-header-actions">
          <button
            type="button"
            className="cc-button cc-button-secondary"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            className="cc-button cc-button-primary"
            onClick={openCreate}
          >
            <span aria-hidden="true">+</span>
            Add Company
          </button>
        </div>
      </header>

      {error && (
        <div className="cc-alert cc-alert-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="cc-alert cc-alert-success" role="status">
          <Icon name="check" size={17} />
          {success}
        </div>
      )}

      <section className="cc-stats" aria-label="Company statistics">
        <StatCard
          label="Active Companies"
          value={stats.total}
          detail="Registered active HTEs"
        />
        <StatCard
          label="Valid Signed MOAs"
          value={stats.signed}
          detail="Signed, not expired or expiring soon"
          variant="success"
        />
        <StatCard
          label="Expiring Soon"
          value={stats.expiring}
          detail={`Expires within ${MOA_EXPIRING_WITHIN_DAYS} days`}
          variant="warning"
        />
        <StatCard
          label="Expired MOAs"
          value={stats.expired}
          detail="Require renewal or review"
          variant="danger"
        />
        <StatCard
          label="Unsigned MOAs"
          value={stats.pending}
          detail="Awaiting signed agreement"
        />
      </section>

      {expiringCompanies.length > 0 && (
        <section className="cc-alert cc-alert-warning">
          <div>
            <strong>
              {stats.expiring} agreement{stats.expiring === 1 ? '' : 's'} approaching expiration
            </strong>
            <p>
              {expiringCompanies.map((company) => company.name).join(', ')}
            </p>
          </div>
          <button
            type="button"
            className="cc-button cc-button-secondary"
            onClick={() => setFilter('expiring')}
          >
            Review MOAs
          </button>
        </section>
      )}

      <section className="cc-card cc-directory">
        <div className="cc-section-header">
          <div>
            <span className="cc-section-kicker">PARTNER DIRECTORY</span>
            <h2>Registered Companies</h2>
          </div>

          <span className="cc-counter">
            {filteredCompanies.length} records
          </span>
        </div>

        <div className="cc-toolbar">
          <label className="cc-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, industry, contact..."
              aria-label="Search companies"
            />
          </label>

          <label className="cc-filter">
            <span className="cc-sr-only">Filter by MOA status</span>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as CompanyFilter)
              }
            >
              <option value="all">All Companies</option>
              <option value="signed">Signed MOAs</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired MOAs</option>
              <option value="pending">Not Signed</option>
              <option value="inactive">Inactive Companies</option>
            </select>
          </label>
          <button
            type="button"
            className="cc-button cc-button-secondary"
            disabled={loading || exporting || !filteredCompanies.length}
            onClick={() => void exportCompanies()}
          >
            <Icon name="download" size={17} />
            {exporting ? 'Exporting…' : 'Export companies (.xlsx)'}
          </button>
        </div>

        {loading ? (
          <div className="cc-empty" role="status">
            <strong>Loading company directory...</strong>
            <p>Retrieving company records from AIMS.</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="cc-empty">
            <div className="cc-empty-symbol">⌕</div>
            <strong>No companies found</strong>
            <p>
              {search || filter !== 'all'
                ? 'Try changing your search or status filter.'
                : 'Start by registering your first partner company.'}
            </p>
            {!search && filter === 'all' && (
              <button
                type="button"
                className="cc-button cc-button-primary"
                onClick={openCreate}
              >
                Add Company
              </button>
            )}
          </div>
        ) : (
          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>MOA Status</th>
                  <th>Internship intake</th>
                  <th>Expiration</th>
                  <th>Account</th>
                  <th className="cc-actions-heading">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCompanies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div className="cc-company-cell">
                        <span className="cc-company-avatar">
                          {initials(company.name)}
                        </span>
                        <div>
                          <strong>{company.name}</strong>
                          <small>
                            {company.industry || 'Industry not specified'}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="cc-cell-stack">
                        <strong>
                          {company.contact_person || 'No contact person'}
                        </strong>
                        <small>
                          {company.contact_email || 'No email provided'}
                        </small>
                      </div>
                    </td>

                    <td>
                      <CompanyBadge company={company} />
                    </td>
                    <td>
                      <IntakeAvailability value={company.intake} />
                    </td>

                    <td>
                      <div className="cc-cell-stack">
                        <span className="cc-date-cell">{formatDate(company.moa_expires_at)}</span>
                        {company.moa_expires_at && getMoaStatus(company) === 'expiring' &&
                          <small>{moaDaysLeftLabel(daysUntilMoaExpiry(company.moa_expires_at))}</small>}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`cc-account-status ${
                          company.is_active
                            ? 'cc-account-status--active'
                            : 'cc-account-status--inactive'
                        }`}
                      >
                        {company.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td>
                      <div className="cc-row-actions">
                        <button
                          type="button"
                          onClick={() => openView(company)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(company)}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cc-bottom-grid">
        <article className="cc-card cc-info-card">
          <div className="cc-section-header">
            <div>
              <span className="cc-section-kicker">AGREEMENT MONITORING</span>
              <h2>MOA Expiration Watch</h2>
              <p>Signed MOAs expiring within {MOA_EXPIRING_WITHIN_DAYS} days.</p>
            </div>
          </div>

          {expiringCompanies.length === 0 ? (
            <div className="cc-mini-empty">
              No signed agreements expire within {MOA_EXPIRING_WITHIN_DAYS} days.
            </div>
          ) : (
            <div className="cc-watch-list">
              {expiringCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className="cc-watch-item"
                  onClick={() => openView(company)}
                >
                  <span>
                    <strong>{company.name}</strong>
                    <small>
                      Expires {formatDate(company.moa_expires_at)}
                    </small>
                  </span>
                  <span className="cc-watch-days">
                    {moaDaysLeftLabel(daysUntilMoaExpiry(company.moa_expires_at!))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="cc-card cc-info-card">
          <div className="cc-section-header">
            <div>
              <h2>Quick links</h2>
            </div>
          </div>

          <button
            type="button"
            className="cc-quick-link"
            onClick={() => onNavigate('applications')}
          >
            <span>
              <strong>Applications & Placements</strong>
              <small>View current internship application activity</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>

          <button
            type="button"
            className="cc-quick-link"
            onClick={() => onNavigate('notifications')}
          >
            <span>
              <strong>Notifications</strong>
              <small>View internship updates and reminders</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>
        </article>
      </section>

      {dialog && (
        <div
          className="cc-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog()
          }}
        >
          <section
            className="cc-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === 'create'
                ? 'Add Company'
                : dialog === 'edit'
                  ? 'Edit Company'
                  : 'Company Details'
            }
          >
            <header className="cc-modal-header">
              <div>
                <span className="cc-section-kicker">
                  {dialog === 'create'
                    ? 'NEW PARTNERSHIP'
                    : dialog === 'edit'
                      ? 'UPDATE PARTNERSHIP'
                      : 'COMPANY PROFILE'}
                </span>
                <h2>
                  {dialog === 'create'
                    ? 'Add Company'
                    : dialog === 'edit'
                      ? 'Edit Company'
                      : selected?.name}
                </h2>
                <p>
                  {dialog === 'view'
                    ? 'Review registered company and agreement information.'
                    : 'Maintain accurate company and MOA records.'}
                </p>
              </div>

              <button
                type="button"
                className="cc-modal-close"
                onClick={closeDialog}
                aria-label="Close dialog"
                disabled={saving}
              >
                ×
              </button>
            </header>

            {dialog === 'view' && selected ? (
              <div className="cc-modal-content">
                <div className="cc-detail-top">
                  <span className="cc-company-avatar cc-company-avatar--large">
                    {initials(selected.name)}
                  </span>
                  <div>
                    <strong>{selected.name}</strong>
                    <p>{selected.industry || 'Industry not specified'}</p>
                    <CompanyBadge company={selected} />
                  </div>
                </div>

                <div className="cc-detail-grid">
                  {[
                    ['Intern slots', selected.intake?.capacity == null ? 'Not set' : `${selected.intake.remaining} available / ${selected.intake.capacity} total`],
                    ['USTP coverage', selected.ustp_coverage],
                    ['Nature of partnership', selected.nature_of_partnership],
                    ['MOA notarized', formatDate(selected.moa_notarized_at ?? null)],
                    ['Year notarized', selected.moa_notarized_year?.toString()],
                    ['Effectivity (years)', selected.moa_effectivity_years?.toString()],
                    ['Contact person', selected.contact_person],
                    ['Email', selected.contact_email],
                    ['Phone', selected.contact_phone],
                    ['Address', selected.address],
                    ['Website', selected.website],
                    ['MOA reference', selected.moa_reference],
                    ['Date signed', formatDate(selected.moa_signed_at)],
                    ['Effective date', formatDate(selected.moa_effective_at)],
                    ['Expiration date', formatDate(selected.moa_expires_at)],
                    ['Account status', selected.is_active ? 'Active' : 'Inactive'],
                  ].map(([label, value]) => (
                    <div className="cc-detail-field" key={label}>
                      <span>{label}</span>
                      <strong>{value || 'Not provided'}</strong>
                    </div>
                  ))}
                </div>

                <MoaFiles key={selected.id} companyId={selected.id} canUpload />
                {selected.description && (
                  <div className="cc-detail-description">
                    <strong>Description</strong>
                    <p>{selected.description}</p>
                  </div>
                )}

                <div className="cc-modal-footer">
                  <button
                    type="button"
                    className="cc-button cc-button-secondary"
                    onClick={() => void toggleActive(selected)}
                  >
                    {selected.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button
                    type="button"
                    className="cc-button cc-button-primary"
                    onClick={() => openEdit(selected)}
                  >
                    Edit Company
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)}>
                <div className="cc-modal-content">
                  <div className="cc-form-section">
                    <h3>Company Information</h3>

                    <div className="cc-form-grid">
                      <div className="cc-field-full">
                        <FormField
                          label="Company/Agency Name *"
                          value={form.name}
                          onChange={(value) => updateForm('name', value)}
                          maxLength={255}
                          required
                        />
                      </div>

                      <FormField
                        label="Nature of Business"
                        value={form.industry}
                        onChange={(value) => updateForm('industry', value)}
                        maxLength={100}
                      />

                      <FormField
                        label="USTP Coverage"
                        value={form.ustp_coverage}
                        onChange={(value) => updateForm('ustp_coverage', value)}
                        maxLength={255}
                      />

                      <FormField
                        label="Nature of Partnership"
                        value={form.nature_of_partnership}
                        onChange={(value) => updateForm('nature_of_partnership', value)}
                        maxLength={255}
                      />

                      <FormField
                        label="Address"
                        value={form.address}
                        onChange={(value) => updateForm('address', value)}
                        maxLength={500}
                      />

                      <label className="cc-field">
                        <span>MOA Notarized</span>
                        <input
                          type="date"
                          min="1000-01-01"
                          max="9999-12-31"
                          value={form.moa_notarized_at}
                          onChange={({ target: { value } }) =>
                            setForm((current) => ({
                              ...current,
                              moa_notarized_at: value,
                              moa_notarized_year: value.slice(0, 4),
                            }))
                          }
                        />
                      </label>

                      <label className="cc-field">
                        <span>Year Notarized</span>
                        <input
                          type="number"
                          min="1000"
                          max="9999"
                          value={form.moa_notarized_year}
                          readOnly={Boolean(form.moa_notarized_at)}
                          onChange={(event) => updateForm('moa_notarized_year', event.target.value)}
                        />
                      </label>

                      <FormField
                        label="Effectivity (Years)"
                        value={form.moa_effectivity_years}
                        onChange={(value) => updateForm('moa_effectivity_years', value)}
                        type="number" min={1} max={9999}
                      />

                      <FormField
                        label="Contact Person"
                        value={form.contact_person}
                        onChange={(value) => updateForm('contact_person', value)}
                        maxLength={100}
                      />

                      <FormField
                        label="Contact Phone"
                        value={form.contact_phone}
                        onChange={(value) => updateForm('contact_phone', value)}
                        type="tel" maxLength={20}
                      />

                      <FormField
                        label="Website"
                        value={form.website}
                        onChange={(value) => updateForm('website', value)}
                        maxLength={255}
                      />

                      <label className="cc-field">
                        <span>Number of interns *</span>
                        <input type="number" min="1" max="100000" step="1" required value={form.intern_capacity} onChange={event => updateForm('intern_capacity', event.target.value)} />
                      </label>
                    </div>
                    {dialog === 'edit' && selected?.intake && <label className="cc-toggle-row">
                      <span>
                        <strong>Accepting new applications</strong>
                        <small>Turn off to pause new applications for this term.</small>
                      </span>
                      <input type="checkbox" checked={form.accepting_interns}
                        onChange={event => updateForm('accepting_interns', event.target.checked)} />
                    </label>}
                  </div>

                  <div className="cc-form-section">
                    <h3>Memorandum of Agreement</h3>

                    <label className="cc-toggle-row">
                      <span>
                        <strong>MOA Signed</strong>
                        <small>
                          Confirm whether an agreement has been signed.
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.is_moa_signed}
                        onChange={(event) =>
                          updateForm('is_moa_signed', event.target.checked)
                        }
                      />
                    </label>

                    <div className="cc-form-grid">
                      <FormField
                        label="MOA Reference Number"
                        value={form.moa_reference}
                        onChange={(value) =>
                          updateForm('moa_reference', value)
                        }
                        placeholder="e.g. MOA-2026-001"
                      />

                      <FormField
                        label="Date Signed"
                        type="date"
                        value={form.moa_signed_at}
                        onChange={(value) =>
                          updateForm('moa_signed_at', value)
                        }
                      />

                      <FormField
                        label="Effective Date"
                        type="date"
                        value={form.moa_effective_at}
                        onChange={(value) =>
                          updateForm('moa_effective_at', value)
                        }
                      />

                      <FormField
                        label="Expiration Date"
                        type="date"
                        value={form.moa_expires_at}
                        onChange={(value) =>
                          updateForm('moa_expires_at', value)
                        }
                      />
                    </div>
                  </div>

                  {dialog === 'edit' && (
                    <div className="cc-form-section">
                      <h3>Account Status</h3>
                      <label className="cc-toggle-row">
                        <span>
                          <strong>Active Company</strong>
                          <small>
                            Inactive companies are excluded from the
                            student-facing active directory.
                          </small>
                        </span>
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(event) =>
                            updateForm('is_active', event.target.checked)
                          }
                        />
                      </label>
                    </div>
                  )}

                  {formError && (
                    <div className="cc-alert cc-alert-error" role="alert">
                      {formError}
                    </div>
                  )}
                </div>

                <footer className="cc-modal-footer">
                  <button
                    type="button"
                    className="cc-button cc-button-secondary"
                    onClick={closeDialog}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="cc-button cc-button-primary"
                    disabled={saving}
                  >
                    {saving
                      ? 'Saving...'
                      : dialog === 'create'
                        ? 'Register Company'
                        : 'Save Changes'}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
