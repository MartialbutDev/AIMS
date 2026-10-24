import { useEffect,useState } from 'react'
import { apiRequest } from '../services/apiClient'
import '../pages/shared/completion.css'
interface Summary {academic_year:string;semester:string;active_internships:number;officially_completed:number;legacy_completed:number}
export function CompletionOverview(){
  const [data,setData]=useState<Summary|null>(null),[error,setError]=useState('')
  useEffect(()=>{let active=true;apiRequest<Summary>('/api/v1/completion/summary').then(value=>{if(active)setData(value)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
  return <section className="panel completion-section"><div className="completion-content"><span className="stake-kicker">OFFICIAL SCHOOL COMPLETION</span><h2>Internship completion register</h2>{error?<p role="status">Completion totals could not be loaded. Refresh to try again.</p>:data?<><p>AY {data.academic_year} · Semester {data.semester}</p><div className="completion-grid"><div><strong>{data.active_internships}</strong><p>Active internships</p></div><div><strong>{data.officially_completed}</strong><p>Official completions with verified clearance and recorded evidence</p></div></div>{data.legacy_completed>0&&<p>{data.legacy_completed} older completion records require evidence reconciliation and are shown separately.</p>}</>:<p>Loading school completion totals…</p>}</div></section>
}
