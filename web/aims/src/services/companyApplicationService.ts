import { apiRequest, apiRequestBlob } from './apiClient'
export interface CompanyApplication { id:string; student_name:string|null; company_name:string|null; position:string; cover_letter:string|null; status:'endorsed'|'interview'|'accepted'|'rejected'; applied_date:string; resume_id:string|null; application_letter_id:string|null; resume?:{original_filename:string|null}|null; application_letter?:{original_filename:string|null}|null }
export interface CompanyApplicationPage {items:CompanyApplication[];total:number;total_pages:number}
export const listCompanyApplications=(page:number)=>apiRequest<CompanyApplicationPage>(`/api/v1/applications/hte?page=${page}&limit=20`)
export const decideCompanyApplication=(id:string,status:CompanyApplication['status'])=>apiRequest<CompanyApplication>(`/api/v1/applications/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({status})})
export const getCompanyAttachment=(id:string,kind:'resume'|'application_letter')=>apiRequestBlob(`/api/v1/applications/${encodeURIComponent(id)}/attachments/${kind}`)
