import React, { useState } from 'react';
import {
  FileText,
  Search,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Menu,
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const initialReports = [
  {
    id: 12,
    title: 'Weekly Report #12',
    studentName: 'John Dela Cruz',
    date: 'Apr 26, 2026',
    preview: 'Completed the authentication module and integrated JWT tokens...',
    content:
      'This week I completed the authentication module for the main application. I integrated JWT tokens for secure session management and implemented role-based access control. I also fixed several bugs related to login validation and improved the error handling for failed authentication attempts.',
    status: 'pending'
  },
  {
    id: 11,
    title: 'Weekly Report #11',
    studentName: 'Maria Santos',
    date: 'Apr 25, 2026',
    preview: 'Worked on database optimization and query performance...',
    content:
      'Focused on indexing high-traffic queries and structuring relational schemas for the analytics dashboard. Successfully reduced query execution latency across the department metrics modules.',
    status: 'pending'
  },
  {
    id: 10,
    title: 'Weekly Report #10',
    studentName: 'Robert Chen',
    date: 'Apr 24, 2026',
    preview: 'Implemented responsive design for mobile devices...',
    content:
      'Refactored frontend CSS breakpoints to support mobile and tablet displays. Verified cross-browser responsiveness across Chromium and Safari.',
    status: 'pending'
  },
  {
    id: 9,
    title: 'Weekly Report #9',
    studentName: 'Michael Tan',
    date: 'Apr 22, 2026',
    preview: 'Integrated third-party APIs for payment processing...',
    content:
      'Completed sandbox integration for recurring checkout workflows and verified webhook handlers for real-time status updates.',
    status: 'approved'
  }
];

export default function CoordinatorReportsPage({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState(initialReports);
  const [selectedReportId, setSelectedReportId] = useState(12);
  const [searchTerm, setSearchTerm] = useState('');
  const [comment, setComment] = useState('');

  const selectedReport =
    reports.find((r) => r.id === selectedReportId) || reports[0];

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  const filteredReports = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.preview.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApprove = () => {
    setReports((prev) =>
      prev.map((r) => (r.id === selectedReport.id ? { ...r, status: 'approved' } : r))
    );
    setComment('');
  };

  const handleReject = () => {
    if (!comment.trim()) {
      alert('Please add a comment before rejecting the report.');
      return;
    }
    setReports((prev) =>
      prev.map((r) => (r.id === selectedReport.id ? { ...r, status: 'rejected' } : r))
    );
    setComment('');
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      {/* Top Header */}
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
                  Report Review
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <GraduationCap className="w-3 h-3" /> COORDINATOR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {pendingCount} {pendingCount === 1 ? 'report' : 'reports'} pending review
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

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
            Report Review
          </h2>
          <p className="text-xs text-slate-200 mt-0.5 drop-shadow-xs">
            {pendingCount} {pendingCount === 1 ? 'report' : 'reports'} pending review
          </p>
        </div>

        {/* 2-Column Split: List & Review Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Reports List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Search Input */}
            <div className="relative bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reports..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#1a1642]"
              />
            </div>

            {/* Scrollable Report Cards */}
            <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
              {filteredReports.map((report) => {
                const isSelected = selectedReport.id === report.id;
                const isApproved = report.status === 'approved';

                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReportId(report.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-white/95 backdrop-blur-md border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl flex-shrink-0 ${
                          isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate">
                          {report.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{report.studentName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{report.date}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2.5 line-clamp-2 leading-relaxed">
                      {report.preview}
                    </p>

                    <div className="mt-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Report Detail */}
          <div className="lg:col-span-8 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            {/* Header / Title */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedReport.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {selectedReport.studentName}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {selectedReport.date}
                  </span>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                  selectedReport.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}
              >
                {selectedReport.status}
              </span>
            </div>

            {/* Report Content Card */}
            <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {selectedReport.content}
              </p>
            </div>

            {/* Comment Section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Add Comment (Required for rejection, optional for approval)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                placeholder="Provide feedback or notes..."
                className="w-full p-4 rounded-2xl border border-slate-200 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:border-[#1a1642] focus:ring-1 focus:ring-[#1a1642] transition-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleReject}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500 text-red-600 hover:bg-red-50 text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>

              <button
                onClick={handleApprove}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve Report
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}