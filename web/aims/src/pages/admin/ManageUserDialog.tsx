import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AdminUser } from '../../types/dashboard'
import type { UpdateAdminUserInput } from '../../services/adminService'
import './user-management.css'

interface Props {
  user: AdminUser
  mode: 'edit' | 'delete'
  ownAccount: boolean
  busy: boolean
  error: string
  onClose: () => void
  onEdit: () => void
  onSave: (input: UpdateAdminUserInput) => Promise<void>
  onDelete: () => Promise<void>
}
export function ManageUserDialog({ user, mode, ownAccount, busy, error, onClose, onEdit, onSave, onDelete }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [firstName, setFirstName] = useState(user.firstName)
  const [middleName, setMiddleName] = useState(user.middleName ?? '')
  const [lastName, setLastName] = useState(user.lastName)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [active, setActive] = useState(user.isActive)
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (mode === 'delete') {
      if (confirmation.trim().toLowerCase() === user.email.toLowerCase()) await onDelete()
    } else {
      if (!firstName.trim() || !lastName.trim()) return
      await onSave({ firstName: firstName.trim(), middleName: middleName.trim() || null, lastName: lastName.trim(), email: email.trim(), phone: phone.trim() || null, isActive: active })
    }
  }
  return <dialog ref={dialog} className="manage-user-dialog" aria-labelledby="manage-user-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header><div><span className="manage-user-kicker">AIMS · ACCOUNT MANAGEMENT</span><h2 id="manage-user-title">{mode === 'edit' ? 'Edit user account' : 'Delete user account'}</h2></div><button type="button" className="manage-user-close" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></header>
    <div className="manage-user-identity"><span>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span><div><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></div></div>
    <form onSubmit={event => void submit(event)} aria-busy={busy}>
      {mode === 'edit' ? <>
        <p>Update personal details and account access. Roles and student IDs remain tied to the original account.</p>
        <fieldset disabled={busy}><div className="manage-user-grid">
          <label>First name<input autoFocus required maxLength={100} value={firstName} onChange={event => setFirstName(event.target.value)} /></label>
          <label>Last name<input required maxLength={100} value={lastName} onChange={event => setLastName(event.target.value)} /></label>
          <label>Middle name <small>(optional)</small><input maxLength={100} value={middleName} onChange={event => setMiddleName(event.target.value)} /></label>
          <label>Phone <small>(optional)</small><input type="tel" maxLength={20} value={phone} onChange={event => setPhone(event.target.value)} /></label>
          <label className="manage-user-wide">Email address<input type="email" required maxLength={255} readOnly={ownAccount} value={email} onChange={event => setEmail(event.target.value)} />{ownAccount && <small>Your signed-in email cannot be changed here.</small>}</label>
          <label className="manage-user-wide">Account status<select disabled={ownAccount} value={active ? 'active' : 'inactive'} onChange={event => setActive(event.target.value === 'active')}><option value="active">Active — can sign in</option><option value="inactive">Inactive — access disabled</option></select>{ownAccount && <small>You cannot deactivate your own administrator account.</small>}</label>
        </div></fieldset>
        {!active && <p className="manage-user-warning">Saving as Inactive ends existing sign-ins and blocks access. Internship records and account history are preserved.</p>}
        {email.trim().toLowerCase() !== user.email.toLowerCase() && <p className="manage-user-warning">Changing the email ends existing sign-ins and clears the previous email-verification status.</p>}
      </> : <>
        <p className="manage-user-warning">Permanent deletion cannot be undone. Accounts with internship, school, company, or review records cannot be deleted.</p>
        <p>To remove access while preserving records, edit the account and choose <strong>Inactive</strong>.</p>
        <label className="manage-user-confirm">Type <strong>{user.email}</strong> to confirm<input autoFocus autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
      </>}
      {error && <p role="alert" className="manage-user-error">{error}</p>}
      <footer><button type="button" className="manage-user-secondary" disabled={busy} onClick={onClose}>Cancel</button>{mode === 'delete' && <button type="button" className="manage-user-secondary" disabled={busy} onClick={onEdit}>Edit account instead</button>}<button type="submit" className={mode === 'delete' ? 'manage-user-danger' : 'manage-user-primary'} disabled={busy || (mode === 'delete' && (ownAccount || confirmation.trim().toLowerCase() !== user.email.toLowerCase()))}>{busy ? 'Please wait…' : mode === 'edit' ? 'Save changes' : 'Delete account'}</button></footer>
    </form>
  </dialog>
}
