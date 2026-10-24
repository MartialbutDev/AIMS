import { useState } from 'react'
import { Icon } from '../../components/Icons'
import type { DashboardData, DashboardMetric } from '../../types/dashboard'
import './coordinator-ui.css'

interface CoordinatorDashboardPageProps {
  data: DashboardData
  name: string
  onNavigate: (section: string) => void
}

const shortcuts = [
  { number: '01', icon: 'users', title: 'Student records', detail: 'Monitor hours, documents, and evaluations', route: 'students' },
  { number: '02', icon: 'file', title: 'Document review', detail: 'Verify internship requirements', route: 'document-verification' },
  { number: '03', icon: 'briefcase', title: 'Applications', detail: 'Follow student placement progress', route: 'applications' },
] as const

function destination(metric: DashboardMetric) {
  const label = metric.label.toLowerCase()
  if (label.includes('document') || label.includes('verification')) return 'document-verification'
  if (label.includes('application')) return 'applications'
  if (label.includes('student')) return 'students'
  return undefined
}

export function CoordinatorDashboardPage({ data, name, onNavigate }: CoordinatorDashboardPageProps) {
  const [checkedTasks, setCheckedTasks] = useState<string[]>([])
  const completedCount = data.tasks.filter(task => checkedTasks.includes(task)).length
  const maximum = Math.max(...data.chartValues, 1)
  const hasChartData = data.chartValues.some(value => value > 0)
  const chartTotal = data.chartValues.reduce((total, value) => total + value, 0)
  const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())

  return (
    <div className="co-page co-dashboard">
      <div className="citc-page-intro">
        <div><span className="citc-eyebrow">CITC · USTP CAGAYAN DE ORO</span><h1>Coordinator overview</h1><p>A clearer view of every student's internship journey.</p></div>
        <span className="citc-date"><Icon name="clock" size={16} />{date}</span>
      </div>

      <section className="citc-welcome">
        <div className="citc-welcome-copy">
          <span className="citc-hero-kicker">CONNECTING LEARNING WITH EXPERIENCE</span>
          <h2>{data.greeting}, {name || 'Coordinator'}.</h2>
          <p>{data.subtitle || 'Guide your students from their first application to a successful internship.'}</p>
          <button className="citc-gold-button" type="button" onClick={() => onNavigate('students')}>Open student workspace <Icon name="arrow" size={17} /></button>
        </div>
        <div className="citc-pathway" aria-label="Internship process">
          <span className="citc-pathway-label">THE INTERNSHIP JOURNEY</span>
          <ol><li><span>1</span>Application</li><li><span>2</span>Requirements</li><li><span>3</span>Deployment</li><li><span>4</span>Completion</li></ol>
          <small>Support your students. Keep their progress in view.</small>
        </div>
      </section>

      <section className="citc-metrics" aria-label="Internship overview metrics">
        {data.metrics.map(metric => {
          const route = destination(metric)
          const content = <><div className="citc-metric-top"><span className={`citc-icon-tile co-tone-${metric.tone}`}><Icon name={metric.icon} size={20} /></span><span>{metric.label}</span>{route && <Icon name="arrow" size={16} />}</div><strong>{metric.value}</strong><small>{metric.change}</small></>
          return route
            ? <button type="button" className="citc-metric" key={metric.label} onClick={() => onNavigate(route)}>{content}</button>
            : <article className="citc-metric" key={metric.label}>{content}</article>
        })}
      </section>

      <div className="citc-section-heading"><div><span className="citc-eyebrow">YOUR WORKSPACE</span><h2>Where would you like to start?</h2></div><span>Current student assignments</span></div>
      <section className="citc-shortcuts" aria-label="Coordinator quick actions">
        {shortcuts.map(item => <button type="button" key={item.route} onClick={() => onNavigate(item.route)}><div className="citc-shortcut-top"><Icon name={item.icon} size={23} /><span>{item.number}</span></div><h3>{item.title}</h3><p>{item.detail}</p><span className="citc-shortcut-link">Open workspace <Icon name="arrow" size={16} /></span></button>)}
      </section>

      <section className="citc-work-grid">
        <article className="citc-panel">
          <header className="citc-panel-heading"><div><span className="citc-eyebrow">IN THE LOOP</span><h2>Recent activity</h2></div><button type="button" className="citc-link" onClick={() => onNavigate('notifications')}>Notifications <Icon name="arrow" size={15} /></button></header>
          {data.activities.length ? <div className="citc-activity-list">{data.activities.slice(0, 5).map((activity, index) => <div className="citc-activity" key={`${activity.title}-${index}`}><span className={`citc-activity-avatar co-tone-${activity.tone}`}>{activity.initials}</span><div><strong>{activity.title}</strong><p>{activity.detail}</p><span>{activity.time}</span></div></div>)}</div> : <div className="citc-empty"><Icon name="bell" size={26} /><h3>You're up to date</h3><p>New internship activity will appear here.</p></div>}
        </article>
        <article className="citc-panel citc-checklist">
          <header className="citc-panel-heading"><div><span className="citc-eyebrow">STAY ON TRACK</span><h2>{data.tasksTitle || 'Your checklist'}</h2></div><span className="citc-counter">{data.tasks.length - completedCount} left</span></header>
          <p className="citc-checklist-note">Personal checklist for this visit. Checking an item does not approve a student record.</p>
          {data.tasks.length ? <><div className="citc-progress-heading"><span>Completed</span><strong>{completedCount}/{data.tasks.length}</strong></div><div className="citc-progress-track"><span style={{ width: `${completedCount / data.tasks.length * 100}%` }} /></div><div className="citc-tasks">{data.tasks.map((task, index) => <label key={`${task}-${index}`}><input type="checkbox" checked={checkedTasks.includes(task)} onChange={() => setCheckedTasks(current => current.includes(task) ? current.filter(item => item !== task) : [...current, task])} /><span>{task}</span></label>)}</div></> : <div className="citc-empty"><Icon name="check" size={24} /><h3>No checklist items</h3><p>Your current tasks will appear here.</p></div>}
          <button type="button" className="citc-secondary-button" onClick={() => onNavigate('document-verification')}>Open document review <Icon name="arrow" size={16} /></button>
        </article>
      </section>

      <section className="citc-panel citc-analytics">
        <header className="citc-panel-heading"><div><span className="citc-eyebrow">PLACEMENT INSIGHTS</span><h2>{data.chartTitle}</h2><p>{data.chartCaption}</p></div><div className="citc-chart-total"><strong>{chartTotal}</strong><span>across displayed periods</span></div></header>
        {hasChartData ? <div className="citc-chart" role="img" aria-label={data.chartValues.map((value, index) => `${data.chartLabels[index] || `Period ${index + 1}`}: ${value}`).join(', ')}>{data.chartValues.map((value, index) => <div className="citc-chart-column" key={index}><div className="citc-chart-bar-space"><div className={`citc-chart-bar${index === data.chartValues.length - 1 ? ' is-latest' : ''}`} style={{ height: `${Math.max(0, value) / maximum * 100}%` }}><span>{value}</span></div></div><span>{data.chartLabels[index] ?? ''}</span></div>)}</div> : <div className="citc-empty"><Icon name="chart" size={26} /><h3>No activity for these periods</h3><p>Placement insights will appear as applications are recorded.</p></div>}
      </section>

      <aside className="citc-history-note"><span className="citc-icon-tile"><Icon name="file" size={20} /></span><div><strong>Looking for a previous semester?</strong><p>Historical assignments stay available as read-only records.</p></div><button type="button" className="citc-link" onClick={() => onNavigate('historical-students')}>Browse history <Icon name="arrow" size={16} /></button></aside>
      <footer className="citc-footer"><span>Academic Internship Management System</span><span>CITC · USTP Cagayan de Oro</span></footer>
    </div>
  )
}
