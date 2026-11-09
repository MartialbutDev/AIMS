import { useCallback, useEffect, useRef, useState } from 'react'
import { getAcademicRules, getAcademicHistory, saveAcademicRule, PROGRAM_CATALOG, type AcademicRule, type AcademicEvent, type ProgramRequirement } from '../../services/academicRequirementsService'
import './academic-requirements.css'

export function AcademicRequirements() {
  const [items,setItems]=useState<AcademicRule[]>([]), [current,setCurrent]=useState<AcademicRule|null>(null)
  const [draft,setDraft]=useState<AcademicRule|null>(null), [history,setHistory]=useState<AcademicEvent[]>([])
  const [codes,setCodes]=useState(''), [reason,setReason]=useState(''), [addCode,setAddCode]=useState('BSIT')
  const [activate,setActivate]=useState(false), [ready,setReady]=useState(false), [busy,setBusy]=useState(true)
  const [error,setError]=useState(''), [message,setMessage]=useState('')
  const saving=useRef(false)
  const select=useCallback((rule:AcademicRule) => {
    setDraft({...rule,program_requirements:rule.program_requirements?.map(p=>({...p,aliases:[...p.aliases]}))??[]})
    setCodes(rule.practicum_subject_codes.join(', '));setReason('');setActivate(false)
  },[])
  const load=useCallback(async (signal?:AbortSignal) => {
    const [data,events]=await Promise.all([getAcademicRules(signal),getAcademicHistory(signal)])
    if(signal?.aborted)return
    setItems(data.items);setCurrent(data.current);setReady(data.ready);setHistory(events)
    select(data.items.find(r=>r.is_active)??data.current)
  },[select])
  useEffect(()=>{
    const controller=new AbortController()
    Promise.all([getAcademicRules(controller.signal),getAcademicHistory(controller.signal)]).then(([data,events])=>{
      if(controller.signal.aborted)return
      setItems(data.items);setCurrent(data.current);setReady(data.ready);setHistory(events)
      select(data.items.find(r=>r.is_active)??data.current)
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load requirements.')}).finally(()=>{if(!controller.signal.aborted)setBusy(false)})
    return ()=>controller.abort()
  },[select])
  function updateProgram(code:string,updates:Partial<ProgramRequirement>) {
    if(draft)setDraft({...draft,program_requirements:draft.program_requirements?.map(p=>p.code===code?{...p,...updates}:p)})
  }
  async function submit(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();if(!draft||saving.current)return
    const targets=(draft.program_requirements||[]).map(p=>({...p,aliases:p.aliases.map(v=>v.trim()).filter(Boolean)}))
    if(!targets.length){setError('Add at least one program. Its hours may be left blank.');return}
    saving.current=true;setBusy(true);setError('');setMessage('')
    try {
      const payload={...draft,program_requirements:targets,programs:[...new Set(targets.flatMap(p=>[p.code,p.name,...p.aliases]))],practicum_subject_codes:codes.split(',').map(v=>v.trim()).filter(Boolean)}
      const saved=await saveAcademicRule(payload,reason,activate)
      await load();select(saved);setMessage(activate?'Program requirements saved and term activated.':'Program requirements saved. Unconfigured targets remain pending.')
    } catch(e) {setError(e instanceof Error?e.message:'Could not save requirements.')}
    finally {saving.current=false;setBusy(false)}
  }
  const targets=draft?.program_requirements||[]
  const existingCodes=new Set(items.find(item=>item.id===draft?.id)?.program_requirements?.map(p=>p.code)||[])
  return <section className="panel aims-settings-panel academic-requirements">
    <div className="academic-heading"><div><span className="stake-kicker">ACADEMIC GOVERNANCE</span><h2>Academic requirements</h2><p>Set each program’s internship hours for the selected term. Leave a target blank until CITC confirms it.</p></div>
      {current&&<div className="academic-current"><strong>Active term</strong><span>{current.academic_year} · Semester {current.semester}</span><small>{current.program_requirements ? `${current.program_requirements.length} programs · ${current.program_requirements.filter(p=>p.required_hours==null).length} targets pending` : 'Existing shared-hours policy'}</small></div>}</div>
    {error&&<p role="alert" className="academic-error">{error}</p>}{message&&<p role="status">{message}</p>}
    {!ready&&!busy&&<p className="aims-settings-note">Database activation is required before saving.</p>}
    {draft&&<form onSubmit={submit}>
      <div className="academic-toolbar"><label>Choose a term<select disabled={busy} value={draft.id??'defaults'} onChange={e=>{const item=items.find(r=>r.id===e.target.value);if(item)select(item)}}>
        {!items.some(r=>r.id===draft.id)&&<option value={draft.id??'defaults'}>{draft.id?'New term':'Current defaults'}</option>}
        {items.map(r=><option key={r.id} value={r.id!}>{r.academic_year} · Semester {r.semester}{r.is_active?' · Active':''}</option>)}
      </select></label><button type="button" disabled={busy} onClick={()=>{select({...draft,id:null,version:0,is_active:false,locked:false,academic_year:'',semester:'1',program_requirements:targets.map(p=>({...p,required_hours:null}))});setError('');setMessage('')}}>Create another term</button></div>
      {draft.locked&&<p className="aims-settings-note">This term has verified CORs or deployments. Existing enrollment rules and programs are retained. You can still configure program hours with a recorded reason; completed archives keep their original snapshot.</p>}
      {!current?.program_requirements&&!targets.length&&<p className="aims-settings-note">Add programs to replace the selected term’s shared-hours policy. Blank program targets mean “Not configured,” and will block completion requests until official targets are saved.</p>}
      <fieldset disabled={busy||!ready}><legend>Term requirements</legend>
        <div className="academic-grid">
          <label>Academic year<input required pattern="[0-9]{4}-[0-9]{4}" placeholder="2026-2027" value={draft.academic_year} readOnly={!!draft.id||draft.locked} onChange={e=>setDraft({...draft,academic_year:e.target.value})}/></label>
          <label>Semester<select disabled={!!draft.id||draft.locked} value={draft.semester} onChange={e=>setDraft({...draft,semester:e.target.value})}><option value="1">First semester</option><option value="2">Second semester</option></select></label>
          <label className="academic-wide">Practicum subject codes<input required value={codes} onChange={e=>setCodes(e.target.value)}/><small>Separate accepted codes with commas. Retain existing codes for a term already in use.</small></label>
        </div>
        <div className="academic-levels" role="group" aria-label="Accepted year levels"><strong>Accepted year levels</strong>{[1,2,3,4,5,6].map(level=><label key={level}><input type="checkbox" checked={draft.year_levels.includes(level)} onChange={e=>setDraft({...draft,year_levels:e.target.checked?[...draft.year_levels,level]:draft.year_levels.filter(v=>v!==level)})}/>{level}</label>)}</div>
        <div className="academic-program-heading"><h3>Hours by program</h3><p>Attendance can be approved while targets are pending. Only configured targets unlock completion eligibility.</p></div>
        <div className="academic-program-add"><label>Program<select aria-label="Program to add" value={addCode} onChange={e=>setAddCode(e.target.value)}>{PROGRAM_CATALOG.map(p=><option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}</select></label><button type="button" disabled={targets.some(p=>p.code===addCode)} onClick={()=>{const program=PROGRAM_CATALOG.find(p=>p.code===addCode);if(program)setDraft({...draft,program_requirements:[...targets,{...program,aliases:[...program.aliases]}]})}}>Add program</button></div>
        <div className="academic-program-list">{targets.map(program=><article className="academic-program" key={program.code}>
          <header><div><strong>{program.code}</strong><p>{program.name}</p></div><span className={program.required_hours==null?'is-pending':'is-configured'}>{program.required_hours==null?'Not configured':'Configured'}</span></header>
          <div className="academic-grid"><label>Required hours · {program.code}<input aria-label={`Required hours for ${program.code}`} type="number" min="1" max="3000" step="1" placeholder="Not configured" value={program.required_hours??''} onChange={e=>updateProgram(program.code,{required_hours:e.target.value===''?null:Number(e.target.value)})}/><small>Leave blank while the approved target is unknown.</small></label>
          <label>COR program aliases · {program.code}<textarea rows={3} value={program.aliases.join('\n')} onChange={e=>updateProgram(program.code,{aliases:e.target.value.split('\n')})}/><small>One alias per line. The code and full program name are also matched.</small></label></div>
          <button type="button" disabled={Boolean(draft.locked&&existingCodes.has(program.code))} onClick={()=>setDraft({...draft,program_requirements:targets.filter(p=>p.code!==program.code)})}>Remove {program.code}</button>
        </article>)}</div>
        <label>Reason for this change<textarea required minLength={5} maxLength={1000} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <label className="academic-activate"><input type="checkbox" checked={activate} onChange={e=>setActivate(e.target.checked)}/>Make this the active academic term</label>
        <p className="aims-settings-note">Saving a future term does not activate it. Program changes do not overwrite attendance or completed archives.</p>
        <button className="academic-save" type="submit" disabled={!draft.year_levels.length||!targets.length}>{busy?'Saving…':activate?'Save and activate term':'Save requirements'}</button>
      </fieldset>
    </form>}
    <details className="academic-history"><summary>Change history ({history.length})</summary>{!history.length?<p>No administrator changes recorded.</p>:<ol>{history.map(e=><li key={e.id}><strong>{e.after.academic_year} · Semester {e.after.semester}</strong><p>{e.after.program_requirements?.map(p=>`${p.code}: ${p.required_hours??'Not configured'}`).join(' · ')||`${e.after.required_hours} legacy shared hours`}</p><p>{e.reason}</p><small>{e.actor_name} · {new Date(e.created_at+'Z').toLocaleString()} · Version {e.after.version}</small></li>)}</ol>}</details>
  </section>
}
