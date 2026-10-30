import { useEffect, useState } from 'react'
import { apiRequest } from '../../services/apiClient'

interface Session { id: string; label: string; current: boolean; created_at: string; last_seen_at: string; expires_at: string }
const time = (value: string) => new Date(value.endsWith('Z') ? value : value + 'Z').toLocaleString()
export function SessionManager({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Session[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function load() { setBusy(true); setError(''); try { setItems((await apiRequest<{ items: Session[] }>('/api/v1/auth/sessions')).items) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load sessions') } finally { setBusy(false) } }
  useEffect(() => { void load() }, [])
  async function end(session?: Session) {
    if (!window.confirm(session?.current ? 'Sign out of this session?' : session ? 'End this sign-in?' : 'Sign out all other sessions?')) return
    setBusy(true); setError('')
    try {
      await apiRequest(session ? '/api/v1/auth/sessions/' + encodeURIComponent(session.id) : '/api/v1/auth/sessions/revoke-others', { method: session ? 'DELETE' : 'POST' })
      if (session?.current) { onLogout(); return }
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to end session') } finally { setBusy(false) }
  }
  return <section className="panel account-form"><h2>Active sessions</h2><p>Each entry is a sign-in. Older sessions appear when they next connect. Ending sessions also clears phone registrations; phones with a valid sign-in reconnect when AIMS returns to the foreground.</p>{error && <p role="alert" className="account-error">{error}</p>}{items.map(item => <div key={item.id}><strong>{item.label}{item.current ? ' · This session' : ''}</strong><p>Started {time(item.created_at)} · Last active {time(item.last_seen_at)} · Expires {time(item.expires_at)}</p><button type="button" className="outline-button" disabled={busy} onClick={() => void end(item)}>End session</button></div>)}<button type="button" className="outline-button" disabled={busy} onClick={() => void load()}>Refresh sessions</button><button type="button" className="outline-button" disabled={busy} onClick={() => void end()}>Sign out all other sessions</button></section>
}
