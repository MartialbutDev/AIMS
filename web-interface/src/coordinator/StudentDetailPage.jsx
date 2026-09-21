import React, { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  Clock,
  FileText,
  FolderClosed,
  Star,
  MessageSquare,
  CheckCircle2,
  User,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StudentDetailPage({ student, onBack }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('attendance');

  // Fallback defaults if accessed directly
  const data = student || {
    id: 1,
    studentId: '2023-00123',
    initials: 'JD',
    name: 'John Dela Cruz',
    course: 'BS Computer Science',
    email: 'john.delacruz@university.edu',
    phone: '+63 912 345 6789',
    company: 'TechVision Solutions',
    period: 'April 1, 2026 – June 30, 2026',
    supervisor: 'Maria Santos',
    hours: 240,
    totalHours: 500
  };

  const progressPercent = Math.round((data.hours / data.totalHours) * 100);

  // Mock data for Attendance
  const attendanceLogs = [
    { date: 'Apr 25, 2026', timeIn: '08:00 AM', timeOut: '05:00 PM', total: '9h', status: 'complete' },
    { date: 'Apr 24, 2026', timeIn: '08:15 AM', timeOut: '05:10 PM', total: '8.9h', status: 'complete' },
    { date: 'Apr 23, 2026', timeIn: '08:05 AM', timeOut: '05:05 PM', total: '9h', status: 'complete' },
    { date: 'Apr 22, 2026', timeIn: '09:00 AM', timeOut: '05:00 PM', total: '8h', status: 'late' },
  ];

  // Mock data for Reports
  const reportsList = [
    { id: 12, title: 'Weekly Report #12', date: 'Apr 26, 2026', status: 'pending' },
    { id: 11, title: 'Weekly Report #11', date: 'Apr 19, 2026', status: 'approved' },
    { id: 10, title: 'Weekly Report #10', date: 'Apr 12, 2026', status: 'approved' },
  ];

  // Mock data for Documents
  const documentsList = [
    { id: 1, name: 'Endorsement Letter', date: 'Apr 1, 2026', verified: true },
    { id: 2, name: 'Medical Certificate', date: 'Apr 1, 2026', verified: true },
    { id: 3, name: 'Waiver Form', date: 'Apr 2, 2026', verified: true },
  ];

  const renderStars = (count) => {
    return (
      <div className="flex items-center gap-1 text-amber-400">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i < count ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack || (() => navigate('/coordinator/students'))}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Students
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {data.initials}
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                  {data.name}
                </h1>
                <p className="text-[11px] text-slate-500 font-mono">
                  {data.studentId} · {data.course}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-600 text-blue-600 bg-white hover:bg-blue-50 text-xs font-bold transition-all shadow-xs cursor-pointer">
              <MessageSquare className="w-4 h-4" /> Send Message
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer">
              <CheckCircle2 className="w-4 h-4" /> Approve Reports
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Details Card */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-400/20 text-blue-600 flex items-center justify-center mb-3">
              <User className="w-10 h-10" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">{data.name}</h2>
            <p className="text-xs text-slate-400 font-mono mb-6">{data.studentId}</p>

            <div className="w-full space-y-3.5 text-left text-xs text-slate-600 border-t border-slate-100 pt-5">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="truncate">{data.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{data.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="font-semibold text-slate-700">{data.company}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{data.period}</span>
              </div>
            </div>
          </div>

          {/* OJT Progress Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              OJT Progress
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-800">{data.hours}</span>
              <span className="text-xs text-slate-400">/{data.totalHours} hrs</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 font-medium block">
              {progressPercent}% complete
            </span>
          </div>

          {/* Company Supervisor Card */}
          <div className="bg-blue-50/60 rounded-2xl border border-blue-100 p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-blue-600 block">Company Supervisor</span>
            <p className="text-xs font-bold text-slate-800 mt-1">{data.supervisor}</p>
            <p className="text-[11px] text-slate-500">{data.company}</p>
          </div>
        </div>

        {/* Right Column: Tabbed Content Container */}
        <div className="lg:col-span-8 space-y-4">
          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'attendance'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Attendance
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Reports
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FolderClosed className="w-3.5 h-3.5" /> Documents
            </button>

            <button
              onClick={() => setActiveTab('evaluation')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'evaluation'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Star className="w-3.5 h-3.5" /> Evaluation
            </button>
          </div>

          {/* TAB 1: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                      <th className="pb-3 pl-2">Date</th>
                      <th className="pb-3 px-3">Time In</th>
                      <th className="pb-3 px-3">Time Out</th>
                      <th className="pb-3 px-3">Total</th>
                      <th className="pb-3 pr-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 pl-2 pr-3 font-semibold text-slate-800">{log.date}</td>
                        <td className="py-4 px-3 text-slate-600 font-mono">{log.timeIn}</td>
                        <td className="py-4 px-3 text-slate-600 font-mono">{log.timeOut}</td>
                        <td className="py-4 px-3 font-bold text-slate-700">{log.total}</td>
                        <td className="py-4 pr-2 text-right">
                          <span
                            className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-semibold ${
                              log.status === 'complete'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: REPORTS */}
          {activeTab === 'reports' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              {reportsList.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{report.title}</h4>
                      <p className="text-[11px] text-slate-400">{report.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-semibold ${
                        report.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}
                    >
                      {report.status}
                    </span>
                    <button className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer">
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              {documentsList.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{doc.name}</h4>
                      <p className="text-[11px] text-slate-400">Submitted: {doc.date}</p>
                    </div>
                  </div>

                  <button className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer">
                    View
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: EVALUATION */}
          {activeTab === 'evaluation' && (
            <div className="space-y-4">
              {/* Midterm Evaluation Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Midterm Evaluation</h3>
                    <p className="text-[11px] text-slate-400">Submitted Apr 20, 2026</p>
                  </div>
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    Submitted
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Work Quality</p>
                    {renderStars(4)}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Attendance</p>
                    {renderStars(5)}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Communication</p>
                    {renderStars(4)}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Technical Skills</p>
                    {renderStars(5)}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Initiative</p>
                    {renderStars(4)}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Teamwork</p>
                    {renderStars(5)}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Professionalism</p>
                    {renderStars(4)}
                  </div>
                </div>

                {/* Overall Score Banner */}
                <div className="bg-blue-50/50 rounded-xl p-4 flex items-center justify-between border border-blue-100">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">Overall Score</span>
                    <span className="text-2xl font-black text-blue-600">4.5 <span className="text-xs text-slate-400 font-normal">/ 5.0</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Final Evaluation Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Final Evaluation</h3>
                  <p className="text-xs text-slate-400">Not yet submitted</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                    Not Started
                  </span>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer">
                    <Star className="w-3.5 h-3.5 fill-white" /> Start Final Evaluation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}