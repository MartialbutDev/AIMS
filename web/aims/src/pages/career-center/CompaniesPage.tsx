
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icons'
import {
  createCareerCompany,
  getCareerCompanies,
  updateCareerCompany,
  type CareerCompany,
  type CareerCompanyPayload,
} from '../../services/careerCenterService'
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
  name: string
  description: string
  address: string
  contact_person: string
  contact_email: string
  contact_phone: string
  industry: string
  website: string
  is_active: boolean
  is_moa_signed: boolean
  moa_reference: string
  moa_signed_at: string
  moa_effective_at: string
  moa_expires_at: string
}

const emptyForm: CompanyForm = {
  name: '',
  description: '',
  address: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  industry: '',
  website: '',
  is_active: true,
  is_moa_signed: false,
  moa_reference: '',
  moa_signed_at: '',
  moa_effective_at: '',
  moa_expires_at: '',
}

function localToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysUntil(date: string): number {
  const target = Date.parse(`${date}T00:00:00Z`)
  const today = Date.parse(`${localToday()}T00:00:00Z`)
  return Math.round((target - today) / 86400000)
}

type MoaStatus = 'signed' | 'expiring' | 'expired' | 'pending'

function getMoaStatus(company: CareerCompany): MoaStatus {
  if (!company.is_moa_signed) return 'pending'
  if (!company.moa_expires_at) return 'signed'

  const days = daysUntil(company.moa_expires_at)

  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring'

  return 'signed'
}

function statusLabel(status: MoaStatus): string {
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

function formatDate(date: string | null): string {
  if (!date) return 'Not specified'

  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(parsed)
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
    name: company.name,
    description: company.description ?? '',
    address: company.address ?? '',
    contact_person: company.contact_person ?? '',
    contact_email: company.contact_email ?? '',
    contact_phone: company.contact_phone ?? '',
    industry: company.industry ?? '',
    website: company.website ?? '',
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
    name: form.name.trim(),
    description: nullable(form.description),
    address: nullable(form.address),
    contact_person: nullable(form.contact_person),
    contact_email: nullable(form.contact_email),
    contact_phone: nullable(form.contact_phone),
    industry: nullable(form.industry),
    website: nullable(form.website),
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
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
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
          <div className="cc-eyebrow">
            <span className="cc-eyebrow-dot" />
            CAREER CENTER · PARTNERSHIP MANAGEMENT
          </div>

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
          detail="Expires within 30 days"
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
            <p>
              Search, review, and update internship partner records.
            </p>
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
                      <span className="cc-date-cell">
                        {formatDate(company.moa_expires_at)}
                      </span>
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
              <p>Agreements requiring attention within 30 days.</p>
            </div>
          </div>

          {expiringCompanies.length === 0 ? (
            <div className="cc-mini-empty">
              No signed agreements are currently expiring within 30 days.
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
                    {daysUntil(company.moa_expires_at!)}d
                  </span>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="cc-card cc-info-card">
          <div className="cc-section-header">
            <div>
              <span className="cc-section-kicker">QUICK ACCESS</span>
              <h2>Career Center Workspace</h2>
              <p>Continue managing internship placements.</p>
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
                    <p>Basic details of the Host Training Establishment.</p>

                    <div className="cc-form-grid">
                      <div className="cc-field-full">
                        <FormField
                          label="Company Name *"
                          value={form.name}
                          onChange={(value) => updateForm('name', value)}
                          placeholder="Enter registered company name"
                          required
                        />
                      </div>

                      <FormField
                        label="Industry"
                        value={form.industry}
                        onChange={(value) => updateForm('industry', value)}
                        placeholder="e.g. Information Technology"
                      />

                      <FormField
                        label="Website"
                        value={form.website}
                        onChange={(value) => updateForm('website', value)}
                        placeholder="https://example.com"
                      />

                      <FormField
                        label="Contact Person"
                        value={form.contact_person}
                        onChange={(value) => updateForm('contact_person', value)}
                        placeholder="Full name"
                      />

                      <FormField
                        label="Contact Email"
                        type="email"
                        value={form.contact_email}
                        onChange={(value) => updateForm('contact_email', value)}
                        placeholder="contact@company.com"
                      />

                      <FormField
                        label="Contact Phone"
                        type="tel"
                        value={form.contact_phone}
                        onChange={(value) => updateForm('contact_phone', value)}
                        placeholder="Contact number"
                      />

                      <FormField
                        label="Address"
                        value={form.address}
                        onChange={(value) => updateForm('address', value)}
                        placeholder="Company address"
                      />

                      <label className="cc-field cc-field-full">
                        <span>Description</span>
                        <textarea
                          rows={3}
                          value={form.description}
                          onChange={(event) =>
                            updateForm('description', event.target.value)
                          }
                          placeholder="Brief company description..."
                        />
                      </label>
                    </div>
                  </div>

                  <div className="cc-form-section">
                    <h3>Memorandum of Agreement</h3>
                    <p>Record the current partnership agreement.</p>

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
