import { useEffect, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import './system-usage.css'
import { UsageTrend, type DailyUsage } from './UsageTrend'

interface UsageCount { active_users: number; users_today: number }
interface UsageStatistics extends UsageCount {
  daily?: DailyUsage[]
  tracking_started_at?: string | null
  as_of: string
  date: string
  platforms: (UsageCount & { platform: string })[]
  roles: (UsageCount & { role: string })[]
}
const roleNames: Record<string, string> = {
  student: 'Students', coordinator: 'Coordinators', dean: 'Deans',
  career_center: 'Career Center', hte_supervisor: 'Company supervisors', admin: 'Administrators',
}

export function SystemUsage() {
  const [data, setData] = useState<UsageStatistics | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    async function refresh() {
      if (pending || document.hidden) return
      pending = true
      setBusy(true)
      try {
        const result = await apiRequest<UsageStatistics>('/api/v1/analytics/usage', { signal: controller.signal })
        if (!controller.signal.aborted) {
          setData(result)
          setError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load usage statistics.')
      } finally {
        pending = false
        if (!controller.signal.aborted) setBusy(false)
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30000)
    const foreground = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', foreground)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', foreground)
    }
  }, [revision])

  function counts(items: (UsageCount & { label: string })[], caption: string) {
    return <div className="system-usage-table">
      <table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Group</th><th scope="col">Last 5 minutes</th><th scope="col">Today</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.active_users}</td><td>{item.users_today}</td></tr>)}</tbody>
      </table>
    </div>
  }

  return <section className="panel system-usage" aria-labelledby="system-usage-heading">
    <header>
      <div><h2 id="system-usage-heading">System usage</h2><p>Signed-in users viewing AIMS. Today follows Philippine time.</p></div>
      <button type="button" className="outline-button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh usage</button>
    </header>
    {error && <p className="system-usage-error" role="alert">{error}{data && ' Showing the last successful counts.'}</p>}
    {!data && !error && <p role="status">Loading usage statistics…</p>}
    {data && <>
      <div className="system-usage-totals">
        <div><span>Active in the last 5 minutes</span><strong>{data.active_users}</strong></div>
        <div><span>Used AIMS today</span><strong>{data.users_today}</strong></div>
      </div>
      <UsageTrend daily={data.daily} trackingStartedAt={data.tracking_started_at} />
      <div className="system-usage-groups">
        {counts(data.platforms.map(item => ({ ...item, label: item.platform === 'web' ? 'Web' : 'Mobile app' })), 'By platform')}
        {counts(data.roles.map(item => ({ ...item, label: roleNames[item.role] ?? item.role })), 'By role')}
      </div>
      <p className="system-usage-note">Overall totals count each person once. A person using both web and mobile appears in both platform rows.</p>
      <p className="system-usage-updated">Updated {new Date(data.as_of).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })} · Philippine time</p>
    </>}
  </section>
}
