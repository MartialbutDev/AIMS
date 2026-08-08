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

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    try {
      // Try to get documents, but don't fail if endpoint doesn't exist
      let documentsCount = 0;
      try {
        const docResponse = await api.get('/documents/');
        documentsCount = docResponse.data.length;
      } catch (docError) {
        console.warn('Documents endpoint not available, using 0');
      }

      const [applications, dtr, journals] = await Promise.all([
        api.get('/applications/'),
        api.get('/dtr/'),
        api.get('/journals/'),
      ]);

      return {
        applications: applications.data.length,
        documents: documentsCount,
        dtr: dtr.data.length,
        journals: journals.data.length,
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
        documentsData = docResponse.data;
      } catch (docError) {
        console.warn('Documents endpoint not available, skipping');
      }

      const [applications, dtr, journals] = await Promise.all([
        api.get('/applications/'),
        api.get('/dtr/'),
        api.get('/journals/'),
      ]);

      const activities: RecentActivity[] = [];

      applications.data.forEach((app: any) => {
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

      dtr.data.forEach((entry: any) => {
        activities.push({
          id: `dtr-${entry.id}`,
          title: `DTR: ${new Date(entry.date).toLocaleDateString()}`,
          description: `${entry.total_hours || 0}h recorded`,
          time: new Date(entry.created_at).toISOString(),
          type: 'dtr',
          status: entry.status,
        });
      });

      journals.data.forEach((journal: any) => {
        activities.push({
          id: `journal-${journal.id}`,
          title: `Journal: ${journal.title}`,
          description: `Week ${journal.week}`,
          time: new Date(journal.created_at).toISOString(),
          type: 'journal',
          status: journal.status,
        });
      });

      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return activities.slice(0, limit);
    } catch (error: any) {
      console.error('❌ Get recent activities error:', error.response?.data || error.message);
      return [];
    }
  },
};