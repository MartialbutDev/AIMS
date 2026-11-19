import type { InternshipProgress } from '../types/internshipProgress'
import { MonthlyActivityChart } from './MonthlyActivityChart'

const lines = [
  { key: 'first', label: 'Internship starts', singular: 'internship start', color: '#0b0b2f' },
  { key: 'second', label: 'Approved completions', singular: 'approved completion', color: '#a66b00', dash: '6 4' },
] as const
const exclusions: { key: keyof InternshipProgress['excluded']; label: string; singular: string }[] = [
  { key: 'start_dates', label: 'start records without usable confirmed dates', singular: 'start record without a usable confirmed date' },
  { key: 'historical_completions', label: 'historical completions without recorded coordinator approval', singular: 'historical completion without recorded coordinator approval' },
  { key: 'conflicts', label: 'students with conflicting records', singular: 'student with conflicting records' },
  { key: 'future_events', label: 'future-dated events', singular: 'future-dated event' },
]

export function InternshipProgressChart({ progress,
  description = 'Monthly internship starts and coordinator-approved completions for the selected term.',
  emptyMessage = 'No dated internship activity is available for this term and oversight scope.',
}: { progress?: InternshipProgress; description?: string; emptyMessage?: string }) {
  const omitted = exclusions.filter(item => (progress?.excluded[item.key] ?? 0) > 0)
  return <MonthlyActivityChart
    history={progress?.months.map(month => ({ month: month.month, first: month.started_students, second: month.approved_completions }))}
    title="Internship progress over time" description={description} emptyMessage={emptyMessage} series={lines}
    footnote="Counts are students per month, not current active totals. Starts use confirmed internship start dates; completions use recorded approval dates in Philippine time. The chart spans the first through latest recorded month."
    excludedMessages={omitted.map(item => progress!.excluded[item.key] + ' ' + (progress!.excluded[item.key] === 1 ? item.singular : item.label))}
  />
}
