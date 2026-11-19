import type { DeanGenderDistribution } from '../../services/deanAnalyticsService'
import './dean-demographics.css'

const categories = [
  ['male', 'Male'], ['female', 'Female'], ['other', 'Other'],
  ['prefer_not_to_say', 'Prefer not to say'], ['not_provided', 'Not specified'],
] as const

export function DeanDemographics({ distribution, studentCount }: {
  distribution?: DeanGenderDistribution; studentCount: number
}) {
  const valid = distribution && Number.isInteger(studentCount) && studentCount >= 0 &&
    categories.every(([key]) => Number.isInteger(distribution[key]) && distribution[key] >= 0) &&
    categories.reduce((sum, [key]) => sum + distribution[key], 0) === studentCount

  return <section className="dean-oversight__panel dean-demographics" aria-labelledby="dean-demographics-heading">
    <div className="dean-oversight__section-heading">
      <div><h2 id="dean-demographics-heading">Student demographics</h2><p>Recorded gender of students in your selected term and oversight scope.</p></div>
      {valid && <span>{studentCount.toLocaleString()} {studentCount === 1 ? 'student' : 'students'}</span>}
    </div>
    {!valid ? <p className="dean-demographics__empty" role="status">Demographic data is unavailable. Refresh the dashboard to try again.</p>
      : studentCount === 0 ? <p className="dean-demographics__empty">No students in oversight for this term.</p>
      : <>
        <div className="dean-demographics__rows">
          {categories.map(([key, label]) => {
            const count = distribution[key]
            const percentage = count / studentCount * 100
            const percent = percentage.toLocaleString('en-PH', { maximumFractionDigits: 1 }) + '%'
            return <div className="dean-demographics__row" key={key} data-category={key}>
              <span className="dean-demographics__label">{label}</span>
              <div className="dean-demographics__track" role="img" aria-label={`${label}: ${count} students (${percent})`}>
                <span className={`dean-demographics__fill dean-demographics__fill--${key}`} style={{ width: percentage + '%' }} />
              </div>
              <span className="dean-demographics__value"><strong>{count.toLocaleString()}</strong><small>{percent}</small></span>
            </div>
          })}
        </div>
        <p className="dean-oversight__footnote">Each student is counted once. Missing or unrecognized values appear as Not specified.</p>
      </>}
  </section>
}
