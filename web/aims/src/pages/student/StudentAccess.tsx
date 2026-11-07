import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthIdentity } from '../../components/AuthIdentity'
import { studentWrite } from '../../services/studentService'
import { Notice } from './StudentUI'
import { useStudentAction } from './studentHooks'
import './student.css'

export function StudentAccess({ mode }: { mode: 'signup' | 'reset' }) {
  const action = useStudentAction()
  const [registered, setRegistered] = useState(false), [step, setStep] = useState<'email' | 'code' | 'password' | 'done'>('email')
  const [email, setEmail] = useState(''), [challenge, setChallenge] = useState(''), [resetToken, setResetToken] = useState('')
  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    if (data.get('password') !== data.get('confirm')) { action.setError('The passwords do not match.'); return }
    await action.run(async () => {
      await studentWrite('/auth/register/student', { email: String(data.get('email')).trim(), first_name: String(data.get('first_name')).trim(), middle_name: String(data.get('middle_name')).trim() || null, last_name: String(data.get('last_name')).trim(), student_id: String(data.get('student_id')).trim(), password: data.get('password') })
      setRegistered(true)
    }, 'Your account is ready. Sign in to submit your orientation certificate and COR for review.')
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    await action.run(async () => {
      if (step === 'email') {
        const result = await studentWrite<{ challenge_id: string }>('/auth/password-reset/otp/request', { email: email.trim() })
        setChallenge(result.challenge_id); setStep('code')
      } else if (step === 'code') {
        const result = await studentWrite<{ reset_token: string }>('/auth/password-reset/otp/verify', { challenge_id: challenge, otp: data.get('otp') })
        setResetToken(result.reset_token); setStep('password')
      } else {
        if (data.get('password') !== data.get('confirm')) throw new Error('The passwords do not match.')
        await studentWrite('/auth/password-reset/otp/complete', { challenge_id: challenge, reset_token: resetToken, new_password: data.get('password') })
        setResetToken(''); setChallenge(''); setStep('done')
      }
    }, step === 'email' ? 'If the account exists, a reset code has been sent. Check your inbox.' : step === 'code' ? 'Code accepted. Set your new password.' : 'Password reset. You can sign in again.')
  }
  return <main className="citc-auth"><AuthIdentity /><section className="citc-workspace"><div className="citc-workspace-content citc-login-content sw-access"><Link to="/login/student">← Student sign in</Link><p className="citc-overline">CITC · STUDENT ACCESS</p><h1>{mode === 'signup' ? 'Start your journey.' : 'Reset your password.'}</h1><p className="citc-intro">One account for AIMS on web and mobile.</p><Notice error={action.error} message={action.message} />{mode === 'signup' ? !registered && <form className="sw-form" onSubmit={signup}><div className="sw-form-grid">{[['first_name', 'First name'], ['middle_name', 'Middle name (optional)'], ['last_name', 'Last name'], ['student_id', 'Student number']].map(([name, label]) => <label key={name}>{label}<input name={name} required={name !== 'middle_name'} maxLength={name === 'student_id' ? 50 : 100} /></label>)}</div><label>Registered email<input name="email" type="email" autoComplete="email" required /></label><PasswordFields /><button className="primary-button" disabled={action.busy}>Create student account</button><p>Account creation does not approve your internship eligibility. Your orientation certificate and COR must be reviewed first.</p></form> : step !== 'done' && <form className="sw-form" onSubmit={reset}>{step === 'email' && <label>Registered email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>}{step === 'code' && <><label>One-time code<input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label><p>Use the code sent to your registered email. If it expires, <button type="button" className="text-button" onClick={() => { setStep('email'); setChallenge('') }}>request a new code</button>.</p></>}{step === 'password' && <PasswordFields />}<button className="primary-button" disabled={action.busy}>{step === 'email' ? 'Send reset code' : step === 'code' ? 'Verify code' : 'Save new password'}</button></form>}{(registered || step === 'done') && <Link className="sw-link" to="/login/student">Continue to sign in →</Link>}</div></section></main>
}
function PasswordFields() { return <><label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label></> }
