import { useEffect } from 'react'
import { apiRequest } from '../services/apiClient'

export function useUsageActivity(token?: string) {
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    let pending = false
    let lastSent = 0
    async function report() {
      if (document.hidden || pending || Date.now() - lastSent < 30000) return
      pending = true
      try {
        await apiRequest<void>('/api/v1/analytics/activity', {
          method: 'POST', body: JSON.stringify({ platform: 'web' }), signal: controller.signal,
        })
        lastSent = Date.now()
      } catch {
        // Usage reporting retries later without interrupting the current task.
      } finally {
        pending = false
      }
    }
    void report()
    const timer = window.setInterval(() => void report(), 60000)
    const foreground = () => { if (!document.hidden) void report() }
    document.addEventListener('visibilitychange', foreground)
    window.addEventListener('focus', foreground)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', foreground)
      window.removeEventListener('focus', foreground)
    }
  }, [token])
}
