import { sectionCategories } from '../services/activitySections'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { UserSession } from '../types/auth'
import { apiRequest } from '../services/apiClient'
import { notificationChanged } from '../hooks/useNotificationCount'
import './activity-indicators.css'

export type ActivityCategory = 'documents' | 'onboarding' | 'attendance' | 'journals' | 'applications' | 'deployment' | 'completion' | 'grades' | 'placements' | 'corrections' | 'forms' | 'assignments' | 'coordinators' | 'company_access'
interface Bucket { unread: { id: string; record_id: string | null; student_id?: string | null }[]; pending_records: string[]; pending_label: string }
interface Summary { academic_year: string; semester: string; sections: Partial<Record<ActivityCategory, Bucket>>; students: Record<string, Partial<Record<ActivityCategory, Bucket>>> }
interface ContextValue { role: UserSession['role']; data: Summary | null; error: string; refresh: () => void; acknowledge: (ids: string[]) => Promise<void> }
const ActivityContext = createContext<ContextValue | null>(null)
export function ActivityProvider({ session, children }: { session: UserSession; children: ReactNode }) {
  const [data, setData] = useState<Summary | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  const pending = useRef(new Set<string>())
  useEffect(() => {
    let current = true, loading = false
    const controller = new AbortController()
    const load = async () => {
      if (loading || document.visibilityState === 'hidden') return
      loading = true
      try { const result = await apiRequest<Summary>('/api/v1/notifications/activity-summary', { signal: controller.signal }); if (current) { setData(result); setError('') } }
      catch (e) { if (current) setError(e instanceof Error ? e.message : 'Activity indicators could not refresh.') }
      finally { loading = false }
    }
    void load(); const timer = window.setInterval(() => void load(), 15000)
    const reload = () => void load()
    for (const event of ['focus','aims-notifications-changed','aims-workflow-changed']) window.addEventListener(event, reload)
    document.addEventListener('visibilitychange', reload)
    return () => { current = false; controller.abort(); window.clearInterval(timer); for (const event of ['focus','aims-notifications-changed','aims-workflow-changed']) window.removeEventListener(event, reload); document.removeEventListener('visibilitychange', reload) }
  }, [session.accessToken, revision])
  const acknowledge = useCallback(async (ids: string[]) => {
    const fresh = [...new Set(ids)].filter(id => !pending.current.has(id))
    if (!fresh.length) return
    fresh.forEach(id => pending.current.add(id))
    try {
      for (let start = 0; start < fresh.length; start += 1000) await apiRequest('/api/v1/notifications/activity-read', { method:'PUT', body:JSON.stringify({ notification_ids:fresh.slice(start,start+1000) }) })
      notificationChanged()
    } finally { fresh.forEach(id => pending.current.delete(id)) }
  }, [])
  return <ActivityContext.Provider value={{ role: session.role, data, error, refresh, acknowledge }}>{children}</ActivityContext.Provider>
}
interface Scope { categories: readonly ActivityCategory[]; studentId?: string; studentIds?: readonly string[]; recordIds?: readonly string[]; academicYear?: string; semester?: string }
function buckets(data: Summary, scope: Scope) {
  if (scope.academicYear && (scope.academicYear !== data.academic_year || scope.semester !== data.semester)) return []
  const source = scope.studentId ? data.students[scope.studentId] || {} : data.sections
  return scope.categories.flatMap(category => source[category] ? [{ category, ...source[category]! }] : [])
}
export function ActivityBadges({ compact = false, ...scope }: Scope & { compact?: boolean }) {
  const context = useContext(ActivityContext)
  if (!context?.data) return null
  const entries = buckets(context.data, scope), allowed = scope.recordIds ? new Set(scope.recordIds) : null
  const unread = entries.some(b => b.unread.some(n => !allowed || !n.record_id || allowed.has(n.record_id)))
  const pendingByLabel = new Map<string, Set<string>>()
  for (const b of entries) for (const id of b.pending_records) if (!allowed || allowed.has(id)) { const set = pendingByLabel.get(b.pending_label) || new Set<string>(); set.add(`${b.category}:${id}`); pendingByLabel.set(b.pending_label, set) }
  if (!unread && !pendingByLabel.size) return null
  return <span className={`activity-badges${compact ? ' activity-badges--compact' : ''}`}>
    {unread && <span className="activity-unread-dot" role="img" aria-label="New activity" title="New activity you have not viewed" />}
    {[...pendingByLabel].map(([label, ids]) => <span className="activity-pending" key={label} title={`${ids.size} ${label.toLowerCase()}`}>{ids.size} {compact ? <span className="activity-sr-only">{label.toLowerCase()}</span> : label.toLowerCase()}</span>)}
  </span>
}
export function ActivityViewed({ ready = true, revision = '', ...scope }: Scope & { ready?: boolean; revision?: string | number }) {
  const context = useContext(ActivityContext), captured = useRef('')
  const snapshot = useRef<{ identity: string; ids: string[] } | null>(null)
  const identity = JSON.stringify([scope.categories,scope.studentId,scope.studentIds,scope.recordIds,scope.academicYear,scope.semester,revision])
  useEffect(() => {
    if (!ready || !context?.data || captured.current === identity) return
    const allowed = scope.recordIds ? new Set(scope.recordIds) : null
    if (snapshot.current?.identity !== identity) snapshot.current = { identity, ids: buckets(context.data, scope).flatMap(b => b.unread.filter(n => !allowed || (n.record_id ? allowed.has(n.record_id) : Boolean(scope.studentId || (n.student_id && scope.studentIds?.includes(n.student_id)) || context.role === 'student'))).map(n => n.id)) }
    const ids = snapshot.current.ids
    captured.current = identity
    void context.acknowledge(ids).catch(() => { captured.current = ''; /* Keep the server's unread state; retry on the next successful refresh. */ })
    // Capture once per displayed snapshot, not whenever a new alert arrives while a stale record stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, identity, context?.data, context?.acknowledge])
  return null
}
export function PageActivity({ section }: { section: string }) {
  const context = useContext(ActivityContext), categories = sectionCategories[section]
  if (!categories) return null
  if (context?.data && !context.error && !buckets(context.data, {categories}).some(b => b.unread.length || b.pending_records.length)) return null
  return <div className="activity-page-summary">{context?.error ? <span className="activity-error" role="status">Activity indicators could not refresh. <button onClick={context.refresh}>Retry</button></span> : <><span>Current-term activity</span><ActivityBadges categories={categories} /><small>Red dot: not yet viewed · Count: still awaiting action or review</small></>}</div>
}
