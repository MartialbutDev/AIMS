import { apiRequest } from './apiClient'

export interface ProgramRequirement { code: string; name: string; aliases: string[]; required_hours: number | null }
export const PROGRAM_CATALOG: ProgramRequirement[] = [
  { code:'BSIT',name:'Bachelor of Science in Information Technology',aliases:['BS INFORMATION TECHNOLOGY','BS IN INFORMATION TECHNOLOGY'],required_hours:null },
  { code:'BSDS',name:'Bachelor of Science in Data Science',aliases:['BS DATA SCIENCE','BS IN DATA SCIENCE'],required_hours:null },
  { code:'BSCS',name:'Bachelor of Science in Computer Science',aliases:['BS COMPUTER SCIENCE','BS IN COMPUTER SCIENCE'],required_hours:null },
  { code:'BSTCM',name:'Bachelor of Science in Technology Communication Management',aliases:['BS TECHNOLOGY COMMUNICATION MANAGEMENT','BS IN TECHNOLOGY COMMUNICATION MANAGEMENT'],required_hours:null },
]

export interface AcademicRule {
  id: string | null
  academic_year: string
  semester: string
  programs: string[]
  year_levels: number[]
  practicum_subject_codes: string[]
  required_hours: number | null
  program_requirements?: ProgramRequirement[] | null
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
