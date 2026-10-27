import { useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient'
export const notificationChanged = () => window.dispatchEvent(new Event('aims-notifications-changed'))
export function useNotificationCount(account: string) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    setCount(0)
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      void apiRequest<{ unread: number }>('/api/v1/notifications/count').then(result => { if (active) setCount(result.unread) }).catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh); window.addEventListener('aims-notifications-changed', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('aims-notifications-changed', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [account])
  return count
}
