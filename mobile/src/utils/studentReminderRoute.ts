const REMINDER_ROUTES = [
  '/(student)/completion',
  '/(student)/documents',
  '/(student)/dtr',
  '/(student)/journals',
] as const;

export function getStudentReminderRoute(value: unknown): typeof REMINDER_ROUTES[number] | null {
  let payload = value;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { return null; }
  }
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (record.source !== 'coordinator_reminder' && record.source !== 'internship_completion') return null;
  return REMINDER_ROUTES.find(route => route === record.route) ?? null;
}
