import { Icon } from './Icons'
import citcLogo from '../assets/citc-identity.png'
import aimsLogo from '../assets/aims-logo-lockup.png'
import './role-auth.css'

export function AuthIdentity() {
  return (
    <aside className="citc-identity">
      <a href="/" className="citc-system citc-system--logo" aria-label="AIMS home"><img src={aimsLogo} alt="AIMS — Academic Internship Management System" /></a>
      <div className="citc-identity-body">
        <div className="citc-college-logo"><img src={citcLogo} alt="College of Information Technology and Computing" /></div>
        <p className="citc-overline">USTP · CAGAYAN DE ORO</p>
        <h2>Learning with purpose.<br /><span>Experience that matters.</span></h2>
        <p className="citc-identity-intro">Connecting CITC students, the university, and industry partners through every stage of the internship journey.</p>
        <div className="citc-journey" aria-label="Internship journey"><span><Icon name="file" size={18} />Placement</span><i /><span><Icon name="chart" size={18} />Progress</span><i /><span><Icon name="check" size={18} />Completion</span></div>
      </div>
      <p className="citc-university">University of Science and Technology<br />of Southern Philippines</p>
    </aside>
  )
}
