import { ActivityBadges, ActivityViewed } from '../../components/ActivityIndicators'
import { useEffect, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
interface Correction { id:string; dtr_id:string; student_id:string; status:string; original:{time_in:string;time_out:string|null}; proposed:{time_in:string;time_out:string}; history:{action:string;reason:string;at:string}[] }
export function DTRCorrectionsPage({role}:{role:string}) {
  const [rows,setRows]=useState<Correction[]>([])
  const [error,setError]=useState('')
  const [revision,setRevision]=useState(0)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    const controller=new AbortController()
    apiRequest<Correction[]>('/api/v1/dtr-corrections',{signal:controller.signal}).then(setRows).catch(()=>{if(!controller.signal.aborted)setError('Could not load corrections')})
    return ()=>controller.abort()
  },[revision])
  async function decide(row:Correction,approve:boolean){
    const reason=window.prompt('Enter the reason for your decision (at least 5 characters)')
    if(!reason || reason.trim().length<5)return
    setBusy(true);setError('')
    try{await apiRequest('/api/v1/dtr-corrections/'+row.id+'/decision',{method:'POST',body:JSON.stringify({approve,reason})});setRevision(value=>value+1)}
    catch(e){setError(e instanceof Error?e.message:'Decision failed')}
    finally{setBusy(false)}
  }
  return <section className="panel" style={{padding:24}}><h1>DTR corrections</h1><ActivityViewed categories={['corrections']} ready={rows.length > 0 && !error} recordIds={rows.map(row => row.id)} revision={revision} />
    {error&&<p role="alert">{error}</p>}
    {!rows.length&&<p>No correction requests available.</p>}
    {rows.map(row=><article key={row.id} style={{borderBottom:'1px solid #ddd',padding:16,overflowWrap:'anywhere'}}>
      <ActivityBadges categories={['corrections']} recordIds={[row.id]} /><h2>{row.status.replaceAll('_',' ')}</h2><p>Student {row.student_id} · DTR {row.dtr_id}</p>
      <details open><summary>Original and requested times</summary><p>Original {row.original.time_in} – {row.original.time_out || 'Missing clock-out'}</p><p>Requested {row.proposed.time_in} – {row.proposed.time_out}</p></details>
      <details><summary>Decision history</summary><ul>{row.history.map((event,index)=><li key={index}>{event.action.replaceAll('_',' ')} · {new Date(event.at).toLocaleString()}<p>{event.reason}</p></li>)}</ul></details>
      {(role==='company' ? row.status==='company_review' : role==='coordinator' && row.status==='coordinator_review')&&<div><button disabled={busy} onClick={()=>decide(row,true)}>{role==='company'?'Confirm attendance':'Approve correction'}</button> <button disabled={busy} onClick={()=>decide(row,false)}>Decline</button></div>}
    </article>)}
  </section>
}


