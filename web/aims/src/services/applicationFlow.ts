export const applicationSteps = ['Prepare documents', 'Submit application', 'Upload endorsement', 'Track review', 'Complete pre-deployment', 'Await deployment approval'] as const;
export function applicationStep(stage: string) {
  const states: Record<string, { index: number; message: string; action: string; kind: string }> = {
    prepare: { index: 0, message: 'Select your current approved resume and application letter.', action: 'Continue', kind: 'prepare' },
    submit: { index: 1, message: 'Check your company and attachments before submitting.', action: 'Submit application', kind: 'submit' },
    upload_endorsement: { index: 2, message: 'Upload your school-issued endorsement letter before forwarding.', action: 'Upload endorsement', kind: 'endorsement' },
    endorsement_review: { index: 2, message: 'Your endorsement letter is awaiting approval.', action: 'Refresh status', kind: 'refresh' },
    coordinator_review: { index: 3, message: 'Your coordinator is reviewing your application.', action: 'Refresh status', kind: 'refresh' },
    company_review: { index: 3, message: 'Your application is awaiting the company’s decision.', action: 'Refresh status', kind: 'refresh' },
    pre_deployment: { index: 4, message: 'Complete these requirements before deployment.', action: 'View checklist', kind: 'checklist' },
    deployment_approval: { index: 5, message: 'Your requirements are approved. Await coordinator approval.', action: 'View checklist', kind: 'checklist' },
    deployed: { index: 6, message: 'Deployment approved. You can now record attendance.', action: 'Open attendance', kind: 'attendance' },
    completed: { index: 6, message: 'Your internship is complete.', action: 'View archive', kind: 'completion' },
  };
  return states[stage] || null;
}
export function documentLabel(status: string, version?: string, current = false) {
  if (current) return 'Current approved';
  if (version === 'superseded') return 'Previous version';
  if (version === 'revoked' || status === 'approval_revoked') return 'Approval revoked';
  if (status === 'rejected') return 'Rejected';
  if (version === 'pending_replacement') return 'Pending replacement';
  if (status === 'verified') return 'Approved';
  return 'Pending review';
}
export function uploadFileError(file: { name: string; size?: number; type?: string }) {
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return 'Choose a PDF, JPG or PNG.';
  if (file.size != null && file.size > 10 * 1024 * 1024) return 'Choose a file of 10 MB or smaller.';
  if (file.size === 0) return 'This file is empty. Choose another copy.';
  if (file.type && !['application/pdf', 'image/jpeg', 'image/png', 'application/octet-stream'].includes(file.type)) return 'Choose a PDF, JPG or PNG.';
  return '';
}
