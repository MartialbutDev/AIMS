import type { StudentFeedback } from '../services/studentService'
export function StudentDocumentFeedback({ value }: { value?: StudentFeedback }) {
  if (!value) return null
  return <div className="sw-notice"><p>{value.reason}</p>{value.next_action && <p>{value.next_action}</p>}</div>
}
