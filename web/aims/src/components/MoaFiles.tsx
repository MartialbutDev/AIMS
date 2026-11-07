import { useEffect, useState } from 'react'
import { apiRequest, apiRequestBlob } from '../services/apiClient'
interface MoaFile {id:string;filename:string;uploaded_at:string;note:string;moa_reference:string|null;expiry_date:string|null}
export function MoaFiles({companyId,canUpload=false}:{companyId:string;canUpload?:boolean}) {
  const [files,setFiles]=useState<MoaFile[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
  const [file,setFile]=useState<File|null>(null),[note,setNote]=useState('')
  const path=`/api/v1/companies/${encodeURIComponent(companyId)}/moa-files`
  useEffect(()=>{const c=new AbortController();apiRequest<MoaFile[]>(path,{signal:c.signal}).then(data=>{setFiles(data);setError('')}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[path,revision])
  async function upload(){if(!file)return;setBusy(true);setError('');try{const body=new FormData();body.append('file',file);body.append('note',note);await apiRequest(path,{method:'POST',body});setFile(null);setNote('');setRevision(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Upload failed')}finally{setBusy(false)}}
  async function download(item:MoaFile){setError('');try{const blob=await apiRequestBlob(`${path}/${item.id}`);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=item.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(e){setError(e instanceof Error?e.message:'Download failed')}}
  return <section style={{borderTop:'1px solid #dce0ea',paddingTop:20,marginTop:20}}><h3>Signed MOA files</h3><p>Download the signed agreement and retained earlier versions. Uploading a file does not authenticate signatures or change the company’s MOA status.</p>
    {error&&<p role="alert">{error}</p>}
    {files.length===0&&!error&&<p>No signed MOA files uploaded.</p>}
    <ul>{files.map((item,index)=><li key={item.id} style={{marginBottom:16}}><button type="button" onClick={()=>download(item)}>Download {item.filename}</button>{index===0&&<strong> · Latest upload</strong>}<p>{item.note}</p><small>{new Date(item.uploaded_at+'Z').toLocaleString()} · Reference: {item.moa_reference||'Not recorded'} · Expiry: {item.expiry_date||'Not recorded'}</small></li>)}</ul>
    {canUpload&&<div style={{display:'grid',gap:12}}><label>Signed agreement PDF (maximum 10 MB)<input key={revision} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label><label>Description or replacement reason<textarea maxLength={1000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)} style={{width:'100%',minHeight:70}}/></label><button type="button" disabled={busy||!file||note.trim().length<5} onClick={upload}>{busy?'Uploading…':'Upload signed MOA'}</button></div>}
  </section>
}
