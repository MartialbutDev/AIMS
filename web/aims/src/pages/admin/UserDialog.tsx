import { useState, type FormEvent } from 'react'
import { roleLabels } from '../../types/auth'

import type {
  AdminUserRole,
  CreateAdminUserInput,
} from '../../types/dashboard'

type CreatableRole = Exclude<AdminUserRole, 'student'>

interface AdminUserDialogProps {
  isSaving: boolean
  error: string
  onClose: () => void
  onCreate: (input: CreateAdminUserInput) => Promise<void>
}

const availableRoles: {
  value: CreatableRole
  label: string
}[] = [
  {
    value: 'coordinator',
    label: roleLabels.coordinator,
  },
  {
    value: 'dean',
    label: roleLabels.dean,
  },
  {
    value: 'career_center',
    label: roleLabels.career_center,
  },
  {
    value: 'company',
    label: 'Company Supervisor',
  },
  {
    value: 'admin',
    label: roleLabels.admin,
  },
]

export function AdminUserDialog({
  isSaving,
  error,
  onClose,
  onCreate,
}: AdminUserDialogProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<CreatableRole>('coordinator')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving) return

    await onCreate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      role,
    })
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSaving
        ) {
          onClose()
        }
      }}
    >
      <section
        className="user-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
      >
        <div className="dialog-heading">
          <div>
            <span className="welcome-eyebrow">
              USER MANAGEMENT
            </span>

            <h2 id="add-user-title">Add New User</h2>

            <p>
              Create an account for an AIMS stakeholder.
            </p>
          </div>

          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <form
          className="user-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="form-two-columns">
            <label>
              First Name

              <input
                type="text"
                required
                maxLength={100}
                value={firstName}
                onChange={(event) =>
                  setFirstName(event.target.value)
                }
                placeholder="Enter first name"
              />
            </label>

            <label>
              Last Name

              <input
                type="text"
                required
                maxLength={100}
                value={lastName}
                onChange={(event) =>
                  setLastName(event.target.value)
                }
                placeholder="Enter last name"
              />
            </label>
          </div>

          <label>
            Email Address

            <input
              type="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="name@ustp.edu.ph"
            />
          </label>

          <label>
            Temporary Password

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter temporary password"
            />
          </label>

          <label>
            Stakeholder Role

            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as CreatableRole)
              }
            >
              {availableRoles.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <p className="user-form-note">
            Student accounts are managed through the
            student registration process.
          </p>

          <div className="dialog-actions">
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={isSaving}
            >
              {isSaving ? 'Creating User...' : 'Create User'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}