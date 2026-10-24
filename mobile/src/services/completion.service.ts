import api from './api'
export interface StudentCompletion {
  can_write?:boolean;deployment_id:string|null;status?:string;configured?:boolean;policy_reference?:string|null;ready?:boolean;required_hours?:number;approved_hours?:number|null;expected_weeks?:number[];grade?:number|null;passing_grade_max?:number|null;completed_at?:string|null;completion_notes?:string|null;legacy_completion?:boolean
  checks?:{key:string;label:string;passed:boolean;detail:string}[]
  clearance_items?:{id:string;label:string;mode:'file'|'physical';status:string;original_filename:string|null;review_notes:string|null}[]
  company_evaluation?:{status:string;submitted_at:string;reviewed_at:string|null}|null
}
export const completionService={
  async getMine():Promise<StudentCompletion>{return (await api.get('/completion/my')).data},
  async upload(itemId:string,file:{uri:string;name:string;mimeType?:string|null}):Promise<StudentCompletion>{const body=new FormData();body.append('file',{uri:file.uri,name:file.name,type:file.mimeType||'application/pdf'} as any);return (await api.post(`/completion/items/${encodeURIComponent(itemId)}/file`,body,{headers:{'Content-Type':'multipart/form-data'},timeout:60000})).data},
}
