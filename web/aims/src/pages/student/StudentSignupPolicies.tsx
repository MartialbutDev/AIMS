import { useEffect, useId, useRef, useState } from 'react'
import { signupPolicies, type SignupPolicyKind } from './signupPolicies'

export function StudentSignupPolicies({ busy, onConsentChange }: { busy: boolean; onConsentChange: (accepted: boolean) => void }) {
  const [read, setRead] = useState({ terms: false, privacy: false })
  const [accepted, setAccepted] = useState({ terms: false, privacy: false })
  const [open, setOpen] = useState<SignupPolicyKind | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const hint = useId()
  const checkboxId = useId()

  function acknowledge(kind: SignupPolicyKind, checked: boolean) {
    const next = { ...accepted, [kind]: checked }
    setAccepted(next)
    onConsentChange(next.terms && next.privacy && read.terms && read.privacy)
  }

  return <>
    <fieldset className="signup-policies" disabled={busy} aria-describedby={hint}>
      <legend>Terms and privacy</legend>
      <p id={hint}>Read each document to enable its checkbox.</p>
      {(['terms', 'privacy'] as const).map(kind => <div className="signup-policy-row signup-policy-choice" key={kind}>
        <input id={checkboxId + kind} type="checkbox" name={kind === 'terms' ? 'terms_accepted' : 'privacy_acknowledged'}
          aria-label={kind === 'terms' ? 'I agree to the Terms and Conditions.' : 'I have read the Privacy Policy.'}
          required disabled={!read[kind]} checked={accepted[kind]} onChange={event => acknowledge(kind, event.target.checked)} />
        <div className="signup-policy-choice-copy">
          <label htmlFor={checkboxId + kind}>{kind === 'terms' ? 'I agree to the ' : 'I have read the '}</label>
          <button type="button" className="signup-policy-link" aria-label={'Read ' + signupPolicies[kind].title} aria-haspopup="dialog" onClick={event => { opener.current = event.currentTarget; setOpen(kind) }}>{signupPolicies[kind].title}</button>
        </div>
      </div>)}
    </fieldset>
    {open && <PolicyDialog key={open} kind={open} onClose={() => setOpen(null)} returnFocus={() => opener.current?.focus()} onRead={() => { setRead(previous => ({ ...previous, [open]: true })); setOpen(null) }} />}
  </>
}

function PolicyDialog({ kind, onClose, onRead, returnFocus }: { kind: SignupPolicyKind; onClose: () => void; onRead: () => void; returnFocus: () => void }) {
  const policy = signupPolicies[kind]
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const title = useId()
  const hint = useId()
  const [atEnd, setAtEnd] = useState(false)
  const returnFocusRef = useRef(returnFocus)

  function checkEnd() {
    const element = body.current
    if (element && element.scrollHeight - element.scrollTop - element.clientHeight <= 8) setAtEnd(true)
  }

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    body.current?.focus()
    const observer = new ResizeObserver(checkEnd)
    if (body.current) observer.observe(body.current)
    if (content.current) observer.observe(content.current)
    return () => {
      observer.disconnect()
      if (element.open) element.close()
      document.body.style.overflow = previousOverflow
      returnFocusRef.current()
    }
  }, [])

  return <dialog ref={dialog} className="signup-policy-dialog" aria-labelledby={title} aria-describedby={hint} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0)
    const first = elements[0], last = elements[elements.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><div><h2 id={title}>{policy.title}</h2><p>Updated {policy.updated}</p></div><button type="button" aria-label={`Close ${policy.title}`} onClick={onClose}>Close</button></header>
    <div ref={body} className="signup-policy-body" tabIndex={0} role="region" aria-label={`${policy.title} content`} onScroll={checkEnd}>
      <div ref={content}>{policy.sections.map(section => <section key={section.title}><h3>{section.title}</h3><p>{section.body}</p></section>)}</div>
    </div>
    <footer><p id={hint} role="status">{atEnd ? 'Return to the form to select your checkbox.' : 'Scroll to the end to continue.'}</p><button type="button" className="signup-policy-done" disabled={!atEnd} onClick={onRead}>Done reading</button></footer>
  </dialog>
}
