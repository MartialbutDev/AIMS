import { useEffect, useState } from 'react'
import { getAcademicRules, getAcademicHistory, saveAcademicRule, type AcademicRule, type AcademicEvent } from '../../services/academicRequirementsService'
import './academic-requirements.css'

export function AcademicRequirements() {
  const [items,setItems]=useState<AcademicRule[]>([])
  const [current,setCurrent]=useState<AcademicRule|null>(null)
  const [draft,setDraft]=useState<AcademicRule|null>(null)
  const [history,setHistory]=useState<AcademicEvent[]>([])
  const [programs,setPrograms]=useState('')
  const [codes,setCodes]=useState('')
  const [reason,setReason]=useState('')
  const [activate,setActivate]=useState(false)
  const [ready,setReady]=useState(false)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  function select(rule:AcademicRule) {
    setDraft({...rule});setPrograms(rule.programs.join('\n'));setCodes(rule.practicum_subject_codes.join(', '));setReason('');setActivate(false)
  }
  async function load(signal?:AbortSignal) {
    const [data,events]=await Promise.all([getAcademicRules(signal),getAcademicHistory(signal)])
    setItems(data.items);setCurrent(data.current);setReady(data.ready);setHistory(events)
    select(data.items.find(r=>r.is_active)??data.current)
  }
  useEffect(()=>{
    const controller=new AbortController()
    Promise.all([getAcademicRules(controller.signal),getAcademicHistory(controller.signal)]).then(([data,events])=>{
      if(controller.signal.aborted)return
      setItems(data.items);setCurrent(data.current);setReady(data.ready);setHistory(events)
      select(data.items.find(r=>r.is_active)??data.current)
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load requirements.')}).finally(()=>{if(!controller.signal.aborted)setBusy(false)})
    return ()=>controller.abort()
  },[])
  async function submit(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();if(!draft)return
    setBusy(true);setError('');setMessage('')
    try {
      const payload={...draft,programs:programs.split('\n').map(v=>v.trim()).filter(Boolean),practicum_subject_codes:codes.split(',').map(v=>v.trim()).filter(Boolean)}
      const saved=await saveAcademicRule(payload,reason,activate)
      await load();select(saved);setMessage(activate?'Requirements saved and academic term activated.':'Requirements saved.')
    } catch(e) {setError(e instanceof Error?e.message:'Could not save requirements.')}
    finally {setBusy(false)}
  }
  return <section className="panel aims-settings-panel academic-requirements">
    <div className="academic-heading"><div><span className="stake-kicker">ACADEMIC GOVERNANCE</span><h2>Academic requirements</h2><p>Manage the rules used for COR checks, internship hours and completion. Changes require an administrator and a recorded reason.</p></div>
      {current&&<div className="academic-current"><strong>Active term</strong><span>{current.academic_year} · Semester {current.semester}</span><small>{current.required_hours} required hours</small></div>}</div>
    {error&&<p role="alert" className="academic-error">{error}</p>}{message&&<p role="status">{message}</p>}
    {!ready&&!busy&&<p className="aims-settings-note">Database activation is required before saving. Current environment-defined requirements remain in use.</p>}
    {draft&&<form onSubmit={submit}>
      <div className="academic-toolbar"><label>Choose a term<select disabled={busy} value={draft.id??'defaults'} onChange={e=>{const item=items.find(r=>r.id===e.target.value);if(item)select(item)}}>
        {!items.some(r=>r.id===draft.id)&&<option value={draft.id??'defaults'}>{draft.id?'New term':'Current defaults'}</option>}
        {items.map(r=><option key={r.id} value={r.id!}>{r.academic_year} · Semester {r.semester}{r.is_active?' · Active':''}{r.locked?' · Locked':''}</option>)}
      </select></label><button type="button" disabled={busy} onClick={()=>{select({...draft,id:null,version:0,is_active:false,locked:false,academic_year:'',semester:'1'});setError('');setMessage('')}}>Create another term</button></div>
      {draft.locked&&<p className="aims-settings-note">This term already has verified CORs or deployment records. Its requirements are locked. Create a new term to change the rules.</p>}
      <fieldset disabled={busy||!ready}><legend>Term requirements</legend>
        <div className="academic-grid">
          <label>Academic year<input required pattern="[0-9]{4}-[0-9]{4}" placeholder="2026-2027" value={draft.academic_year} readOnly={!!draft.id||draft.locked} onChange={e=>setDraft({...draft,academic_year:e.target.value})}/></label>
          <label>Semester<select disabled={!!draft.id||draft.locked} value={draft.semester} onChange={e=>setDraft({...draft,semester:e.target.value})}><option value="1">First semester</option><option value="2">Second semester</option></select></label>
          <label>Required internship hours<input type="number" required min="1" max="3000" step="1" readOnly={draft.locked} value={draft.required_hours} onChange={e=>setDraft({...draft,required_hours:Number(e.target.value)})}/></label>
          <label>Practicum subject codes<input required readOnly={draft.locked} value={codes} onChange={e=>setCodes(e.target.value)}/><small>Separate accepted codes with commas.</small></label>
          <label className="academic-wide">Accepted program names or aliases<textarea required rows={3} readOnly={draft.locked} value={programs} onChange={e=>setPrograms(e.target.value)}/><small>One name per line. Add the program names and abbreviations actually printed on approved CORs. These programs share the term’s required hours.</small></label>
        </div>
        <div className="academic-levels" role="group" aria-label="Accepted year levels"><strong>Accepted year levels</strong>{[1,2,3,4,5,6].map(level=><label key={level}><input type="checkbox" disabled={draft.locked} checked={draft.year_levels.includes(level)} onChange={e=>setDraft({...draft,year_levels:e.target.checked?[...draft.year_levels,level]:draft.year_levels.filter(v=>v!==level)})}/>{level}</label>)}</div>
        <label>Reason for this change<textarea required minLength={5} maxLength={1000} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <label className="academic-activate"><input type="checkbox" checked={activate} onChange={e=>setActivate(e.target.checked)}/>Make this the active academic term</label>
        <p className="aims-settings-note">Activation changes the current-term workspace for students and stakeholders. Historical internship records stay in their original term. Saving alone does not activate a future term.</p>
        <button className="academic-save" type="submit" disabled={draft.year_levels.length===0}>{busy?'Saving…':activate?'Save and activate term':'Save requirements'}</button>
      </fieldset>
    </form>}
    <details className="academic-history"><summary>Change history ({history.length})</summary>{history.length===0?<p>No administrator changes recorded.</p>:<ol>{history.map(e=><li key={e.id}><strong>{e.after.academic_year} · Semester {e.after.semester} · {e.after.required_hours} hours</strong><p>{e.reason}</p><small>{e.actor_name} · {new Date(e.created_at+'Z').toLocaleString()} · Version {e.after.version}</small></li>)}</ol>}</details>
  </section>
}
