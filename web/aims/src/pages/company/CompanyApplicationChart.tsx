import { MonthlyActivityChart } from '../../components/MonthlyActivityChart'
import type { CompanyApplicationActivity } from '../../types/applicationActivity'

const lines = [
  { key: 'first', label: 'Applications received', singular: 'application received', color: '#0b0b2f' },
  { key: 'second', label: 'Applications accepted', singular: 'application accepted', color: '#a66b00', dash: '6 4' },
] as const
const exclusions: { key: keyof CompanyApplicationActivity['excluded']; singular: string; plural: string }[] = [
  { key: 'receipt_dates', singular: 'referral missing a date or approver', plural: 'referrals missing dates or approvers' },
  { key: 'acceptance_dates', singular: 'acceptance missing a date or reviewer', plural: 'acceptances missing dates or reviewers' },
  { key: 'future_events', singular: 'future-dated event', plural: 'future-dated events' },
  { key: 'invalid_dates', singular: 'event with invalid dates', plural: 'events with invalid dates' },
]

export function CompanyApplicationChart({ activity, term }: { activity?: CompanyApplicationActivity; term: string }) {
  return <div className="company-application-trend"><MonthlyActivityChart
    history={activity?.months.map(month => ({ month: month.month, first: month.received_applications, second: month.accepted_applications }))}
    title="Applications received and accepted"
    description={term}
    emptyMessage="No recorded outcomes for this term."
    missingMessage="Application history unavailable. Refresh the page."
    series={lines}
    footnote="Linked companies · Recorded referral and acceptance dates · Philippine time."
    excludedMessages={exclusions.filter(item => (activity?.excluded[item.key] ?? 0) > 0).map(item =>
      activity!.excluded[item.key] + ' ' + (activity!.excluded[item.key] === 1 ? item.singular : item.plural))}
  /></div>
}
