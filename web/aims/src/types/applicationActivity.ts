export interface ApplicationActivity {
  months: { month: string; forwarded_applications: number; accepted_applications: number }[]
  timezone: string
  excluded: { forwarding_dates: number; acceptance_dates: number; future_events: number; invalid_dates: number }
}

export interface CompanyApplicationActivity {
  months: { month: string; received_applications: number; accepted_applications: number }[]
  timezone: string
  excluded: { receipt_dates: number; acceptance_dates: number; future_events: number; invalid_dates: number }
}
