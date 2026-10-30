import type { UserSession } from '../types/auth'
import type { UserNotification } from '../types/dashboard'

export interface WebAlertPreferences { enabled: boolean; previews: boolean }
export const WEB_ALERT_EVENT = 'aims-web-alert-preferences'
export function webAlertKey(session: Pick<UserSession, 'email' | 'role'>) {
  return `aims.web-alerts.${session.role}.${session.email.toLowerCase()}`
}
export function readWebAlerts(key: string): WebAlertPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    return { enabled: value?.enabled !== false, previews: value?.previews !== false }
  } catch { return { enabled: true, previews: true } }
}
export function saveWebAlerts(key: string, value: WebAlertPreferences) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event(WEB_ALERT_EVENT))
}
// The first successful poll is a baseline, not a burst of old alerts.
export function collectArrivals(previous: Set<string> | null, rows: UserNotification[]) {
  const seen = new Set(previous ?? [])
  const arrivals: UserNotification[] = []
  for (const row of rows) {
    if (previous && !seen.has(row.id) && !row.isRead) arrivals.push(row)
    seen.add(row.id)
  }
  // Bound memory while retaining considerably more than the latest poll window.
  while (seen.size > 2000) seen.delete(seen.values().next().value!)
  return { seen, arrivals }
}
