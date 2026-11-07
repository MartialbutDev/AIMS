import { useCallback, useEffect, useRef, useState } from 'react'

export const human = (value?: string | null) => (value || 'Not available').replace(/_/g, ' ')
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed. Please try again.'
export const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
export const localTime = () => new Date().toTimeString().slice(0, 8)
export function useStudentLoad<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0)
  const loaderRef = useRef(loader); loaderRef.current = loader
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setData(null)
    void loaderRef.current().then(result => { if (active) setData(result) }).catch(e => { if (active) setError(errorText(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // The caller explicitly supplies request identities; loaderRef avoids inline function loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...dependencies])
  return { data, error, loading, refresh }
}
export function useStudentAction(refresh?: () => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const pending = useRef(false)
  async function run(action: () => Promise<unknown>, success = 'Saved successfully.') {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success); refresh?.(); return true }
    catch (e) { setError(e instanceof TypeError ? 'Connection lost. Refresh the record list before retrying; the server may already have received your submission.' : errorText(e)); return false }
    finally { pending.current = false; setBusy(false) }
  }
  return { busy, error, message, run, setError }
}
