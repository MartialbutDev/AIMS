const REMINDER_ROUTES = [
  '/(student)/applications/direct-placements',
  '/(student)/documents',
  '/(student)/documents/templates',
  '/(student)/applications',
  '/(student)/pre-deployment',
  '/onboarding',
  '/(student)/notifications',
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
  return REMINDER_ROUTES.find(route => route === record.route) ?? null;
}
