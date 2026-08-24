import React from 'react';
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  CheckCircle2, 
  Bell, 
  BarChart3, 
  ChevronRight, 
  Clock, 
  HelpCircle,
  Menu
} from 'lucide-react';

const DepartmentDashboard = ({ onNavigate, onOpenSidebar }) => {
  const coordinators = [
    {
      id: 1,
      initials: 'KA',
      name: 'Ken Ampolitod',
      section: 'BSIT 4A & 4B',
      students: 48,
      completion: 87,
      avatarBg: 'bg-[#1A1D4E]',
      barColor: 'bg-[#F5A800]',
    },
    {
      id: 2,
      initials: 'FI',
      name: 'Faisal Inidal',
      section: 'BSCS 4A & 4B',
      students: 36,
      completion: 92,
      avatarBg: 'bg-[#2D3270]',
      barColor: 'bg-[#1A1D4E]',
    },
    {
      id: 3,
      initials: 'ML',
      name: 'Maikent Lopez',
      section: 'BSIS 4A',
      students: 24,
      completion: 78,
      avatarBg: 'bg-[#F5A800]',
      barColor: 'bg-[#F5A800]',
    },
    {
      id: 4,
      initials: 'VN',
      name: 'Varren Naive',
      section: 'BSCE 4A',
      students: 20,
      completion: 95,
      avatarBg: 'bg-[#1A1D4E]',
      barColor: 'bg-[#1A1D4E]',
    },
  ];

  const activities = [
    {
      id: 1,
      dotColor: 'bg-[#F5A800]',
      text: 'Ken Ampolitod approved 3 student documents',
      time: '30 mins ago',
    },
    {
      id: 2,
      dotColor: 'bg-[#1A1D4E]',
      text: 'Faisal Inidal posted a new announcement',
      time: '1 hour ago',
    },
    {
      id: 3,
      dotColor: 'bg-[#2D3270]',
      text: 'Maikent Lopez completed mid-term evaluations for BSIS 4A',
      time: '3 hours ago',
    },
    {
      id: 4,
      dotColor: 'bg-[#F5A800]',
      text: 'New company MOA submitted for review',
      time: 'Yesterday',
    },
    {
      id: 5,
      dotColor: 'bg-[#1A1D4E]',
      text: 'Varren Naive submitted final student grades',
      time: '2 days ago',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F5F9] p-6 lg:p-10 font-sans text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenSidebar}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-[#1A1D4E] hover:bg-slate-50 transition shadow-sm cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1D4E]">Department Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Welcome back, <span className="font-semibold text-[#1A1D4E]">Dr. Junar A. Landicho</span> · Dean / Chairman · CITE
            </p>
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => onNavigate('notifications')}
            className="p-2.5 bg-white border border-slate-200 rounded-full text-[#1A1D4E] hover:bg-slate-100 transition shadow-sm cursor-pointer"
          >
            <Bell size={20} />
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-[#F5A800] rounded-full">
              4
            </span>
          </button>
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-[#F5A800] mb-4">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Coordinators</span>
            <div className="text-3xl font-bold text-[#1A1D4E] my-1">4</div>
            <span className="text-xs text-slate-400">Active this term</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#1A1D4E] mb-4">
            <Users size={20} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Total Students</span>
            <div className="text-3xl font-bold text-[#1A1D4E] my-1">128</div>
            <span className="text-xs text-slate-400">114 currently active</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-[#F5A800] mb-4">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Avg. Completion</span>
            <div className="text-3xl font-bold text-[#1A1D4E] my-1">88%</div>
            <span className="text-xs text-slate-400">Across all sections</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#1A1D4E] mb-4">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Submissions</span>
            <div className="text-3xl font-bold text-[#1A1D4E] my-1">94%</div>
            <span className="text-xs text-slate-400">Pending review: 12</span>
          </div>
        </div>
      </div>

      {/* USTP Progress Banner */}
      <div className="bg-gradient-to-r from-[#1A1D4E] via-[#242866] to-[#1A1D4E] rounded-2xl p-6 mb-8 text-white shadow-md border-t-4 border-[#F5A800]">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F5A800] rounded-xl">
              <TrendingUp size={22} className="text-[#1A1D4E]" />
            </div>
            <span className="font-semibold text-base">Department OJT Completion Rate</span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#F5A800]">88%</div>
            <div className="text-xs text-slate-300">overall completion</div>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div className="bg-[#F5A800] h-3 rounded-full" style={{ width: '88%' }}></div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Coordinator Overview
              </h2>
              <button 
                onClick={() => onNavigate('coordinators')}
                className="text-xs font-semibold text-[#F5A800] hover:text-amber-600 flex items-center gap-0.5 cursor-pointer"
              >
                View all <ChevronRight size={14} />
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 px-6 py-4 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Coordinator</div>
                <div className="col-span-3">Section</div>
                <div className="col-span-2 text-center">Students</div>
                <div className="col-span-3">Completion</div>
              </div>

              <div className="divide-y divide-slate-50">
                {coordinators.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 items-center px-6 py-4 text-sm hover:bg-slate-50/50 transition">
                    <div className="col-span-4 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${c.avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0`}>
                        {c.initials}
                      </div>
                      <span className="font-semibold text-slate-800 truncate">{c.name}</span>
                    </div>

                    <div className="col-span-3 text-slate-500">{c.section}</div>
                    <div className="col-span-2 text-center font-medium text-slate-700">{c.students}</div>

                    <div className="col-span-3 flex items-center justify-between gap-3">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${c.barColor}`} style={{ width: `${c.completion}%` }}></div>
                      </div>
                      <span className="text-xs font-medium text-slate-600 w-8 text-right">{c.completion}%</span>
                      <ChevronRight size={16} className="text-slate-300 shrink-0 cursor-pointer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Recent Activity
            </h2>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${activity.dotColor} shrink-0`} />
                    <span className="text-slate-700 font-normal">{activity.text}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock size={13} />
                    <span>{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Quick Access
            </h2>
            <div className="space-y-3">
              <button 
                onClick={() => onNavigate('coordinators')}
                className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-[#F5A800] transition text-left cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#F5A800] text-[#1A1D4E] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Users size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Coordinators</div>
                  <div className="text-xs text-slate-400">View details & students</div>
                </div>
              </button>

              <button className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-[#1A1D4E]/30 transition text-left group">
                <div className="w-10 h-10 rounded-xl bg-[#1A1D4E] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Analytics</div>
                  <div className="text-xs text-slate-400">Department performance</div>
                </div>
              </button>

              <button 
                onClick={() => onNavigate('notifications')}
                className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-[#F5A800] transition text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#2D3270] text-[#F5A800] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Bell size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Notifications</div>
                  <div className="text-xs text-slate-400">4 unread alerts</div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-[#1A1D4E] border border-slate-800 rounded-2xl p-5 text-white shadow-sm">
            <h3 className="font-semibold text-sm mb-4 text-[#F5A800]">Department Status</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Active students</span>
                <span className="font-bold text-white text-sm">114/128</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Avg completion</span>
                <span className="font-bold text-[#F5A800] text-sm">88%</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Coordinators</span>
                <span className="font-bold text-white text-sm">4 active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button className="fixed bottom-6 right-6 w-10 h-10 bg-white border border-slate-200 shadow-md rounded-full flex items-center justify-center text-[#1A1D4E] hover:text-[#F5A800] transition">
        <HelpCircle size={20} />
      </button>
    </div>
  );
};

export default DepartmentDashboard;