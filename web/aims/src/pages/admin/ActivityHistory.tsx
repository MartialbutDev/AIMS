import { useEffect, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import './company-access.css'

const categories = ['Documents', 'Placements', 'Completion', 'Academic requirements', 'Signed MOAs']
interface Activity {
  id: string
  category: string
  occurred_at: string
  actor: string
  action: string
  reference: string
}
interface HistoryPage { items: Activity[]; has_more: boolean }

export function ActivityHistory() {
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<HistoryPage | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError('')
    const params = new URLSearchParams({ category, page: String(page) })
    apiRequest<HistoryPage>('/api/v1/admin/activity-history?' + params, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load activity. Select Refresh to try again.') })
    return () => controller.abort()
  }, [category, page, revision])

  return <section className="company-access">
    <header><h1>Activity history</h1><p>Review recorded internship decisions, academic requirement changes, and signed MOA uploads.</p></header>
    <section className="panel company-access-panel">
      <div className="company-access-section-heading">
        <label>Activity category
          <select value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}>
            <option value="all">All categories</option>
            {categories.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
        <button className="outline-button" onClick={() => setRevision(value => value + 1)}>Refresh</button>
      </div>
      {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading activity…</p> :
        data.items.length === 0 ? <p>No recorded activity on this page.</p> :
        <div className="company-access-table-wrap">
          <table aria-label="Recorded activity, newest first">
            <thead><tr>{['When', 'Category', 'Action', 'Performed by', 'Record reference'].map(name => <th key={name} scope="col">{name}</th>)}</tr></thead>
            <tbody>{data.items.map(item => <tr key={item.category + item.id}>
              <td>{new Date(item.occurred_at + 'Z').toLocaleString()}</td>
              <td>{item.category}</td><td>{item.action}</td><td>{item.actor}</td><td>{item.reference}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      <nav aria-label="Activity pages" className="company-access-form-actions">
        <button className="outline-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="outline-button" disabled={!data?.has_more} onClick={() => setPage(page + 1)}>Next</button>
      </nav>
    </section>
  </section>
}
