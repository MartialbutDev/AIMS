import api from './api'
export interface DirectPlacement {
  id: string; company_name: string; company_id: string | null; position: string; reason: string; status: string;
  partnership_ready: boolean; partnership_status: string; partnership_notes: string | null;
  student_decision: string; application_status: string | null; coordinator_ready: boolean;
  deployment: { id: string; status: string } | null;
  history?: { id: string; action: string; actor_name: string; created_at: string; details: Record<string, unknown> }[];
}
export const directPlacementService = {
  async list(page = 1): Promise<{ items: DirectPlacement[]; total: number; limit: number }> { return (await api.get('/direct-placements', { params: { page, limit: 20 } })).data },
  async detail(id: string): Promise<DirectPlacement> { return (await api.get(`/direct-placements/${encodeURIComponent(id)}`)).data },
  async decide(id: string, decision: 'acknowledge' | 'decline', reason = ''): Promise<DirectPlacement> { return (await api.post(`/direct-placements/${encodeURIComponent(id)}/student-decision`, { decision, reason })).data },
}
