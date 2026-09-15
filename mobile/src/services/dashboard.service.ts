// src/services/dashboard.service.ts
import api from './api';

export interface DashboardStats {
  applications: number;
  documents: number;
  dtr: number;
  journals: number;
}

export interface RecentActivity {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'application' | 'document' | 'journal' | 'dtr';
  status?: 'pending' | 'approved' | 'rejected' | 'submitted';
}

/**
 * Safely extract an array from either:
 *   - a paginated response `{ items: [...] }`
 *   - a plain array `[...]`
 *   - anything else → []
 */
const toArray = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && Array.isArray(payload.items)) return payload.items as T[];
  return [];
};

/**
 * Extract a total count from either:
 *   - a paginated envelope `{ total: number }`
 *   - a plain array (length)
 */
const countOf = (payload: any): number => {
  if (payload && typeof payload.total === 'number') return payload.total;
  return toArray(payload).length;
};

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    try {
      // Documents endpoint is optional — don't fail the whole dashboard if it errors
      let documentsCount = 0;
      try {
        const docResponse = await api.get('/documents/');
        documentsCount = toArray<any>(docResponse.data).length;
      } catch (docError) {
        console.warn('Documents endpoint not available, using 0');
      }

      // Fetch only 1 item per resource — the `total` field gives the real count
      const [applicationsRes, dtrRes, journalsRes] = await Promise.all([
        api.get('/applications/?page=1&limit=1'),
        api.get('/dtr/?page=1&limit=1'),
        api.get('/journals/?page=1&limit=1'),
      ]);

      return {
        applications: countOf(applicationsRes.data),
        documents: documentsCount,
        dtr: countOf(dtrRes.data),
        journals: countOf(journalsRes.data),
      };
    } catch (error: any) {
      console.error('❌ Get stats error:', error.response?.data || error.message);
      return { applications: 0, documents: 0, dtr: 0, journals: 0 };
    }
  },

  async getRecentActivities(limit: number = 5): Promise<RecentActivity[]> {
    try {
      let documentsData: any[] = [];
      try {
        const docResponse = await api.get('/documents/');
        documentsData = toArray<any>(docResponse.data);
      } catch (docError) {
        console.warn('Documents endpoint not available, skipping');
      }

      // Fetch a small slice per resource — just enough to build the top-N timeline
      const slice = Math.max(limit, 10);

      const [applicationsRes, dtrRes, journalsRes] = await Promise.all([
        api.get(`/applications/?page=1&limit=${slice}`),
        api.get(`/dtr/?page=1&limit=${slice}`),
        api.get(`/journals/?page=1&limit=${slice}`),
      ]);

      const applications = toArray<any>(applicationsRes.data);
      const dtr = toArray<any>(dtrRes.data);
      const journals = toArray<any>(journalsRes.data);

      const activities: RecentActivity[] = [];

      applications.forEach((app: any) => {
        activities.push({
          id: `app-${app.id}`,
          title: `Application: ${app.position}`,
          description: `${app.company_name}`,
          time: new Date(app.applied_date).toISOString(),
          type: 'application',
          status: app.status,
        });
      });

      documentsData.forEach((doc: any) => {
        activities.push({
          id: `doc-${doc.id}`,
          title: `Document: ${doc.type?.replace('_', ' ')?.toUpperCase() || 'Document'}`,
          description: doc.description || 'Uploaded document',
          time: new Date(doc.created_at).toISOString(),
          type: 'document',
          status: doc.verification_status,
        });
      });

      dtr.forEach((entry: any) => {
        activities.push({
          id: `dtr-${entry.id}`,
          title: `DTR: ${new Date(entry.date).toLocaleDateString()}`,
          description: `${entry.total_hours || 0}h recorded`,
          time: new Date(entry.created_at).toISOString(),
          type: 'dtr',
          status: entry.status,
        });
      });

      journals.forEach((journal: any) => {
        activities.push({
          id: `journal-${journal.id}`,
          title: `Journal: ${journal.title}`,
          description: `Week ${journal.week}`,
          time: new Date(journal.created_at).toISOString(),
          type: 'journal',
          status: journal.status,
        });
      });

      activities.sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      return activities.slice(0, limit);
    } catch (error: any) {
      console.error('❌ Get recent activities error:', error.response?.data || error.message);
      return [];
    }
  },
};