import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Calendar,
  Users,
  Edit2,
  Trash2,
  Menu,
  GraduationCap,
  Info,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const initialAnnouncements = [
  {
    id: 1,
    title: 'Mid-term Evaluation Due',
    content:
      'All mid-term evaluations must be submitted by April 30, 2026. Please coordinate with your supervisors.',
    date: 'Apr 20, 2026',
    audience: 'All Students',
    views: 45
  },
  {
    id: 2,
    title: 'New Company Partners Available',
    content:
      'We have 5 new company partners offering OJT positions. Check the Company Matching section.',
    date: 'Apr 18, 2026',
    audience: 'Pending Students',
    views: 23
  },
  {
    id: 3,
    title: 'Weekly Report Reminder',
    content: "Don't forget to submit your weekly reports every Friday by 5 PM.",
    date: 'Apr 15, 2026',
    audience: 'All Students',
    views: 48
  }
];

export default function CoordinatorAnnouncementsPage({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    audience: 'All Students'
  });

  const totalCount = announcements.length;
  const totalViews = announcements.reduce((sum, item) => sum + item.views, 0);

  const handleDelete = (id) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    const newAnnouncement = {
      id: Date.now(),
      title: formData.title,
      content: formData.content,
      date: 'May 1, 2026',
      audience: formData.audience,
      views: 0
    };

    setAnnouncements([newAnnouncement, ...announcements]);
    setFormData({ title: '', content: '', audience: 'All Students' });
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      {/* Top Header Bar */}
      <header className="bg-[#1a1642] border-b-2 border-[#f59e0b] px-6 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onOpenSidebar && (
              <button
                onClick={onOpenSidebar}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  Announcements
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <GraduationCap className="w-3 h-3" /> COORDINATOR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {totalCount} {totalCount === 1 ? 'announcement' : 'announcements'} posted
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/coordinator/dashboard')}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Dashboard
            </button>
            <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow">
              AR
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Title & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
              Announcements
            </h2>
            <p className="text-xs text-slate-200 mt-0.5 drop-shadow-xs">
              {totalCount} {totalCount === 1 ? 'announcement' : 'announcements'} posted
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Announcement
          </button>
        </div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Announcements List */}
          <div className="lg:col-span-8 space-y-4">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-[#f59e0b] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        title="Edit announcement"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        title="Delete announcement"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {item.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {item.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {item.audience}
                    </span>
                    <span>{item.views} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Summary and Information Card */}
          <div className="lg:col-span-4 space-y-4">
            {/* Summary Box */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Summary
              </span>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Total</span>
                <span className="font-bold text-slate-800 text-sm">{totalCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-slate-600 font-medium">Total Views</span>
                <span className="font-bold text-slate-800 text-sm">{totalViews}</span>
              </div>
            </div>

            {/* Information Notice Card */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#b45309] leading-relaxed">
                  Announcements are visible to all students in your section immediately after posting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* New Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Create New Announcement</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-term Evaluation Due"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1a1642]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Audience</label>
                <select
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1a1642]"
                >
                  <option value="All Students">All Students</option>
                  <option value="Pending Students">Pending Students</option>
                  <option value="Active Interns">Active Interns</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Content</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write the announcement details here..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1a1642]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold cursor-pointer"
                >
                  Post Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}