
import { useEffect, useState } from 'react'

import {
  getCareerCompanies,
  type CareerCompany,
} from '../../services/careerCenterService'

// ========================================
// PROPS
// ========================================

interface CompaniesPageProps {
  onNavigate: (section: string) => void
}

// ========================================
// COMPANY MANAGEMENT PAGE
// ========================================

export function CompaniesPage({
  onNavigate,
}: CompaniesPageProps) {
  const [companies, setCompanies] = useState<CareerCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // ========================================
  // LOAD COMPANIES
  // ========================================

  useEffect(() => {
    let isCurrent = true

    getCareerCompanies()
      .then((result) => {
        if (!isCurrent) return

        setCompanies(result)
        setError('')
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load company records.'
        )
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [reloadKey])

  // ========================================
  // REFRESH
  // ========================================

  function refreshCompanies() {
    setLoading(true)
    setError('')
    setReloadKey((current) => current + 1)
  }

  // ========================================
  // SEARCH
  // ========================================

  const filteredCompanies = companies.filter((company) => {
    const query = search.trim().toLowerCase()

    return (
      company.name.toLowerCase().includes(query) ||
      (company.contact_email ?? '')
        .toLowerCase()
        .includes(query)
    )
  })

  // ========================================
  // STATISTICS
  // ========================================

  const totalCompanies = companies.length

  const moaSigned = companies.filter(
    (company) => company.is_moa_signed
  ).length

  const moaPending = totalCompanies - moaSigned

  // ========================================
  // RENDER
  // ========================================

  return (
    <section className="workspace-page">
      {/* PAGE HEADER */}

      <div className="workspace-page-heading">
        <div>
          <span className="welcome-eyebrow">
            <span className="eyebrow-dot" />
            CAREER CENTER
          </span>

          <h1>Company Management</h1>

          <p>
            Manage and monitor Host Training Establishments,
            registered company partnerships, and MOA status.
          </p>
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={refreshCompanies}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* COMPANY STATISTICS */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          marginTop: 24,
        }}
      >
        <article className="panel" style={{ padding: 24 }}>
          <h3>Total Active Companies</h3>

          <strong style={{ fontSize: 32 }}>
            {totalCompanies}
          </strong>

          <p>Registered active company profiles</p>
        </article>

        <article className="panel" style={{ padding: 24 }}>
          <h3>MOA Signed</h3>

          <strong style={{ fontSize: 32 }}>
            {moaSigned}
          </strong>

          <p>Companies with signed agreements</p>
        </article>

        <article className="panel" style={{ padding: 24 }}>
          <h3>MOA Not Signed</h3>

          <strong style={{ fontSize: 32 }}>
            {moaPending}
          </strong>

          <p>Companies without signed agreements</p>
        </article>
      </div>

      {/* COMPANY DIRECTORY */}

      <article
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <div className="panel-heading">
          <div>
            <h2>Registered Companies</h2>

            <p>
              Browse companies participating in the
              AIMS internship program.
            </p>
          </div>
        </div>

        {/* SEARCH INPUT */}

        <div style={{ marginBottom: 20 }}>
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search company name or email..."
            aria-label="Search companies"
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
            }}
          />
        </div>

        {/* LOADING STATE */}

        {loading && (
          <p className="empty-state" role="status">
            Loading company records...
          </p>
        )}

        {/* ERROR STATE */}

        {!loading && error && (
          <div>
            <p className="form-error" role="alert">
              {error}
            </p>

            <button
              type="button"
              className="outline-button"
              onClick={refreshCompanies}
            >
              Try Again
            </button>
          </div>
        )}

        {/* EMPTY STATE */}

        {!loading &&
          !error &&
          filteredCompanies.length === 0 && (
            <p className="empty-state">
              {search.trim()
                ? 'No companies match your search.'
                : 'No active companies are registered.'}
            </p>
          )}

        {/* COMPANY TABLE */}

        {!loading &&
          !error &&
          filteredCompanies.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr>
                    <th style={{ padding: 14 }}>
                      Company Name
                    </th>

                    <th style={{ padding: 14 }}>
                      Contact Email
                    </th>

                    <th style={{ padding: 14 }}>
                      MOA Status
                    </th>

                    <th style={{ padding: 14 }}>
                      Account Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCompanies.map((company) => (
                    <tr key={company.id}>
                      <td style={{ padding: 14 }}>
                        <strong>{company.name}</strong>
                      </td>

                      <td style={{ padding: 14 }}>
                        {company.contact_email ||
                          'Not provided'}
                      </td>

                      <td style={{ padding: 14 }}>
                        {company.is_moa_signed
                          ? 'Signed'
                          : 'Not Signed'}
                      </td>

                      <td style={{ padding: 14 }}>
                        {company.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </article>

      {/* MOA OVERVIEW */}

      <article
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <div className="panel-heading">
          <div>
            <h2>MOA Monitoring</h2>

            <p>
              Monitor partnership agreements between
              USTP and registered companies.
            </p>
          </div>
        </div>

        <p>
          Signed agreements: <strong>{moaSigned}</strong>
        </p>

        <p>
          Agreements not signed:{' '}
          <strong>{moaPending}</strong>
        </p>

        <p style={{ opacity: 0.7, fontSize: 14 }}>
          MOA status is based on the company records
          currently stored in AIMS.
        </p>
      </article>

      {/* APPLICATIONS NAVIGATION */}

      <article
        className="panel"
        style={{
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2>Internship Applications</h2>

        <p>
          Review internship application activity
          through the Career Center workspace.
        </p>

        <button
          type="button"
          className="outline-button"
          onClick={() => onNavigate('applications')}
        >
          View Applications
        </button>
      </article>
    </section>
  )
}
