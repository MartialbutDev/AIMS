import { useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient'
import { communications, type DeliveryStatus } from '../services/communicationService'
import { readWebAlerts, saveWebAlerts, WEB_ALERT_EVENT, webAlertKey } from '../services/webAlertPreferences'
import type { UserSession } from '../types/auth'

const categories = [
  ['Applications', [['application_updates', 'Application activity'], ['application_status_changes', 'Application status changes']]],
  ['Attendance', [['dtr_reminders', 'DTR reminders'], ['dtr_approvals', 'DTR approvals'], ['dtr_rejections', 'DTR corrections']]],
  ['Journals', [['journal_reminders', 'Journal reminders'], ['journal_feedback', 'Journal feedback'], ['journal_approvals', 'Journal approvals']]],
  ['Documents and announcements', [['document_verifications', 'Document review updates'], ['document_reminders', 'Document reminders'], ['system_announcements', 'Announcements']]],
] as const

export function NotificationPreferences({ session }: { session: UserSession }) {
  const key = webAlertKey(session)
  const [web, setWeb] = useState(() => readWebAlerts(key))
  const [settings, setSettings] = useState<Record<string, boolean> | null>(null)
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const update = () => setWeb(readWebAlerts(key))
    window.addEventListener(WEB_ALERT_EVENT, update); window.addEventListener('storage', update)
    return () => { window.removeEventListener(WEB_ALERT_EVENT, update); window.removeEventListener('storage', update) }
  }, [key])
  useEffect(() => {
    let active = true
    Promise.allSettled([apiRequest<Record<string, boolean>>('/api/v1/notifications/settings'), communications.delivery()]).then(([preferences, status]) => {
      if (!active) return
      if (preferences.status === 'fulfilled') setSettings(preferences.value)
      if (status.status === 'fulfilled') setDelivery(status.value)
      if (preferences.status === 'rejected' || status.status === 'rejected') setError('Some notification preferences could not load. Please retry.')
    })
    return () => { active = false }
  }, [retry])
  function saveBrowser(field: 'enabled' | 'previews', value: boolean) {
    setMessage(''); setError('')
    try { const next = { ...web, [field]: value }; saveWebAlerts(key, next); setWeb(next); setMessage('Browser alert preference saved.') }
    catch { setError('This browser is blocking preference storage. Your preference could not be saved.') }
  }
  async function save(field: string, value: boolean) {
    setBusy(true); setError(''); setMessage('')
    try {
      setSettings(await apiRequest<Record<string, boolean>>('/api/v1/notifications/settings', { method: 'PUT', body: JSON.stringify({ [field]: value }) }))
      setMessage('Notification preference saved for your account.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save preference.') }
    finally { setBusy(false) }
  }
  async function email(value: boolean) {
    setBusy(true); setError(''); setMessage('')
    try { await communications.email(value); setDelivery(await communications.delivery()); setMessage('Email preference saved.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save email preference.') }
    finally { setBusy(false) }
  }
  const emailAvailable = Boolean(delivery?.email_configured && delivery.email_delivery_enabled && delivery.email_verified)
  return <div className="aims-settings-stack" aria-label="Notification preferences">
    {error && <p className="account-error" role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {message && <p className="account-success" role="status">{message}</p>}
    <section className="panel aims-settings-panel"><h2>Pop-up alerts in this browser</h2><p>Small alerts appear in the corner when new updates arrive while AIMS is open. Updates refresh about every 15 seconds and when you return to the tab.</p>
      <label className="aims-settings-toggle"><input type="checkbox" checked={web.enabled} onChange={event => saveBrowser('enabled', event.target.checked)} /><span><strong>Show in-app toast notifications</strong><small>Saved for your account in this browser. Existing notifications remain in the bell.</small></span></label>
      <label className="aims-settings-toggle"><input type="checkbox" checked={web.previews} disabled={!web.enabled} onChange={event => saveBrowser('previews', event.target.checked)} /><span><strong>Show message previews in alerts</strong><small>Turn off to hide notification titles and messages in pop-up alerts.</small></span></label>
      <p className="aims-settings-note">These alerts appear inside AIMS. They do not appear on the Windows desktop after the website is closed.</p>
    </section>
    <div className="aims-settings-columns">
      <section className="panel aims-settings-panel"><h2>Phone notifications</h2>{settings && delivery ? <><p>{delivery.registered_devices} registered {delivery.registered_devices === 1 ? 'device' : 'devices'}. {delivery.push_delivery_enabled ? 'Phone delivery is enabled on the server.' : 'Phone delivery is awaiting server activation.'}</p><label className="aims-settings-toggle"><input type="checkbox" checked={settings.push_enabled === true} disabled={busy} onChange={event => void save('push_enabled', event.target.checked)} /><span><strong>Allow phone push notifications</strong><small>Applies to your registered mobile devices.</small></span></label><p>Register or reconnect your phone in the mobile app’s notification preferences.</p></> : <p>Loading phone preferences…</p>}</section>
      <section className="panel aims-settings-panel"><h2>Email notifications</h2>{delivery ? <><p>{emailAvailable ? 'Email delivery is available for your verified address.' : !delivery.email_verified ? 'Verify your email address in Account & security first.' : 'Email delivery is awaiting administrator setup.'}</p><label className="aims-settings-toggle"><input type="checkbox" checked={delivery.email_enabled} disabled={busy || (!emailAvailable && !delivery.email_enabled)} onChange={event => void email(event.target.checked)} /><span><strong>Receive email updates</strong><small>{emailAvailable ? 'Send optional alerts to your account email.' : 'You can turn off an existing subscription while delivery is unavailable.'}</small></span></label></> : <p>Loading email preferences…</p>}</section>
    </div>
    <section className="panel aims-settings-panel"><h2>Email and phone alert categories</h2><p>Choose optional delivery categories for your account. Your AIMS notification history remains available in the bell.</p>{!settings ? <p>Loading categories…</p> : <div className="aims-settings-category-grid">{categories.map(([label, fields]) => <fieldset key={label}><legend>{label}</legend>{fields.map(([field, title]) => <label className="aims-settings-toggle" key={field}><input type="checkbox" disabled={busy} checked={settings[field] === true} onChange={event => void save(field, event.target.checked)} /><span>{title}</span></label>)}</fieldset>)}</div>}</section>
  </div>
}
