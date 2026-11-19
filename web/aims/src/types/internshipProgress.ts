export interface InternshipProgress {
  months: { month: string; started_students: number; approved_completions: number }[]
  timezone: string
  excluded: { start_dates: number; historical_completions: number; conflicts: number; future_events: number }
}
