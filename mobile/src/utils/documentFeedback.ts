export interface StudentDocumentFeedback { status_label: string; reason: string; next_action: string; notice: string }
export function documentFeedback(status: string, value?: StudentDocumentFeedback | null, version?: string): StudentDocumentFeedback {
  if (value?.reason && value.next_action && value.status_label) return value;
  const notice = 'Text checks support document review. They do not authenticate signatures or prove that a document is genuine.';
  if (version === 'pending_replacement') return { status_label: 'Pending replacement', reason: 'Your replacement is awaiting review. Your current approved version remains active.', next_action: 'Wait for your coordinator to review the replacement.', notice };
  if (version === 'revoked') return { status_label: 'Approval revoked', reason: 'Approval for this document has been withdrawn.', next_action: 'Read your reviewer feedback and submit the corrected requirement.', notice };
  if (version === 'superseded') return { status_label: 'Previous version', reason: 'A newer approved version is now used for this requirement.', next_action: 'Open the current approved version. This copy remains in your history.', notice };
  if (status === 'verified' && version !== 'pending') return { status_label: 'Approved', reason: 'This document has been accepted for this requirement.', next_action: 'Check your application or deployment checklist for the next requirement.', notice };
  if (status === 'rejected') return { status_label: 'Rejected', reason: 'This submission was not accepted for the selected requirement.', next_action: 'Read your reviewer feedback, if provided. Upload a clear, complete copy of the requested document that belongs to you, or ask your coordinator for help.', notice };
  return { status_label: 'Pending review', reason: 'This document needs review before it can be accepted for this requirement.', next_action: 'Wait for your coordinator to review it. You may upload a clearer, complete copy if needed.', notice };
}
