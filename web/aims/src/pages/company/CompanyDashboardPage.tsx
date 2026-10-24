import { useState } from 'react'
import { Icon } from '../../components/Icons'
import type { DashboardData } from '../../types/dashboard'

interface CompanyDashboardPageProps {
  data: DashboardData
  name: string
  onNavigate: (section: string) => void
}

export function CompanyDashboardPage({ data, name, onNavigate }: CompanyDashboardPageProps) {
  const [checked, setChecked] = useState<string[]>([])
  const max = Math.max(1, ...data.chartValues.filter(Number.isFinite))
  return (
    <section className="workspace-page stake-company-page">
      <header className="stake-page-heading"><div><span className="stake-kicker">CITC / HOST TRAINING ESTABLISHMENT</span><h1>Your next intern.<br /><em>Their next chapter.</em></h1><p>{name ? `${name}, welcome to your` : 'Welcome to your'} USTP industry partner workspace.</p></div><button type="button" className="stake-navy-button" onClick={() => onNavigate('applications')}>Open applicant desk <Icon name="arrow" size={18} /></button></header>

      <section className="stake-employer-desk" aria-label="Company application workspace">
        <div className="stake-employer-mission"><span className="stake-kicker">LEARNING BEYOND THE CLASSROOM</span><h2>Make room for<br />tomorrow's professionals.</h2><p>Review student applications and help turn academic preparation into practical experience.</p><button type="button" className="stake-yellow-button" onClick={() => onNavigate('applications')}>Review student applications <Icon name="arrow" size={17} /></button></div>
        <div className="stake-employer-register"><span className="stake-kicker">AT YOUR ESTABLISHMENT</span>{data.metrics.length ? data.metrics.map(metric => <div className="stake-employer-metric" key={metric.label}><span><Icon name={metric.icon} size={19} /><span>{metric.label}<small>{metric.change}</small></span></span><strong>{metric.value}</strong></div>) : <p className="stake-note">Company metrics will appear when available.</p>}</div>
      </section>

      <nav className="stake-employer-links" aria-label="Partner workspace shortcuts"><button type="button" onClick={() => onNavigate('interns')}><Icon name="briefcase" size={22} /><span><strong>Intern monitoring</strong><small>Attendance, approved hours, and submitted journals</small></span><Icon name="arrow" size={17} /></button><button type="button" onClick={() => onNavigate('applications')}><Icon name="users" size={22} /><span><strong>Applicant desk</strong><small>Review student interest in your establishment</small></span><Icon name="arrow" size={17} /></button><button type="button" onClick={() => onNavigate('notifications')}><Icon name="bell" size={22} /><span><strong>University updates</strong><small>Stay connected with internship announcements</small></span><Icon name="arrow" size={17} /></button></nav>

      <div className="stake-employer-columns"><section className="stake-panel"><header className="stake-panel-title"><div><span className="stake-kicker">APPLICANT ACTIVITY</span><h2>From campus to your team</h2></div><button type="button" className="stake-text-button" onClick={() => onNavigate('applications')}>View applications →</button></header>{data.activities.length ? data.activities.slice(0,6).map((item,index) => <article className="stake-employer-activity" key={`${item.title}-${index}`}><span className="stake-letter-avatar">{item.initials}</span><div><strong>{item.title}</strong><p>{item.detail}</p><time>{item.time}</time></div></article>) : <div className="stake-empty"><Icon name="users" size={28} /><h3>No new applicant activity</h3><p>Student application updates will appear here.</p></div>}</section>
      <aside className="stake-company-checklist"><span className="stake-kicker">THE PARTNER NOTEBOOK</span><h2>{data.tasksTitle || 'Your reminders'}</h2><p className="stake-note">Personal notes for this visit. Checking an item does not change an application.</p>{data.tasks.length ? data.tasks.map((task,index) => <label key={`${task}-${index}`}><input type="checkbox" checked={checked.includes(task)} onChange={() => setChecked(current => current.includes(task) ? current.filter(item => item !== task) : [...current,task])} /><span>{task}</span></label>) : <p className="stake-note">No reminders available.</p>}<div className="stake-company-partner-note"><Icon name="briefcase" size={25} /><strong>Industry experience. Academic purpose.</strong><p>Every placement is an opportunity to help a student put their learning into practice.</p></div></aside></div>

      <section className="stake-panel stake-company-trends"><header className="stake-panel-title"><div><span className="stake-kicker">APPLICATION TRENDS</span><h2>{data.chartTitle || 'Student application activity'}</h2><p>{data.chartCaption}</p></div></header>{data.chartValues.some(value => value > 0) ? <div className="stake-horizontal-chart">{data.chartValues.map((value,index) => {const safe = Number.isFinite(value) ? Math.max(0,value) : 0;return <div key={index}><span>{data.chartLabels[index] || `Period ${index+1}`}</span><div role="img" aria-label={`${data.chartLabels[index] || `Period ${index+1}`}: ${safe}`}><i style={{width:`${safe/max*100}%`}} /></div><strong>{safe}</strong></div>})}</div> : <div className="stake-empty"><p>No applications recorded for these reporting periods.</p></div>}</section>
      <footer className="stake-footer"><span>Academic Internship Management System</span><span>CITC · USTP Cagayan de Oro · Industry Partners</span></footer>
    </section>
  )
}
