import { apiRequest } from './apiClient'

export interface AcademicRule {
  id: string | null
  academic_year: string
  semester: string
  programs: string[]
  year_levels: number[]
  practicum_subject_codes: string[]
  required_hours: number
  version: number
  is_active: boolean
  locked?: boolean
  updated_at?: string
}
export interface AcademicEvent {
  id: string; actor_name: string; reason: string; created_at: string
  before: AcademicRule | null; after: AcademicRule
}
const path='/api/v1/academic-requirements'
export const getAcademicRules=(signal?:AbortSignal)=>apiRequest<{items:AcademicRule[];current:AcademicRule;ready:boolean}>(path,{signal})
export const getAcademicHistory=(signal?:AbortSignal)=>apiRequest<AcademicEvent[]>(`${path}/history`,{signal})
export const saveAcademicRule=(rule:AcademicRule,reason:string,activate:boolean)=>apiRequest<AcademicRule>(path,{
  method:'PUT',body:JSON.stringify({...rule,expected_version:rule.version,reason,activate})})
