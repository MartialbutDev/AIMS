import React from 'react';
import {
  Users,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  Bell,
  Clock,
  ChevronRight,
  BarChart3,
  HelpCircle,
  Menu,
  Shield,
  FileCheck
} from 'lucide-react';

export default function DepartmentDashboard({ onNavigate, onOpenSidebar }) {
  // Top 4 Metric Cards
  const stats = [
    {
      title: 'Coordinators',
      value: '4',
      subtitle: 'Active this term',
      icon: Users,
      iconBg: 'bg-[#1a1642]/10',
      iconColor: 'text-[#1a1642]'
    },
    {
      title: 'Total Students',
      value: '128',
      subtitle: '114 currently active',
      icon: GraduationCap,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#f59e0b]'
    },
    {
      title: 'Avg. Completion',
      value: '88%',
      subtitle: 'Across all sections',
      icon: TrendingUp,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600'
    },
    {
      title: 'Submissions',
      value: '94%',
      subtitle: 'Pending review: 12',
      icon: CheckCircle2,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600'
    }
  ];

  // Coordinator Overview Table Data
  const coordinators = [
    {
      initials: 'AR',
      name: 'Dr. Ana Reyes',
      section: 'BSIT 4A & 4B',
      students: 48,
      completion: 87,
      avatarBg: 'bg-[#1a1642] text-[#f59e0b]',
      barColor: 'bg-[#f59e0b]'
    },
    {
      initials: 'ML',
      name: 'Prof. Mark Lim',
      section: 'BSCS 4A & 4B',
      students: 36,
      completion: 92,
      avatarBg: 'bg-purple-600 text-white',
      barColor: 'bg-emerald-500'
    },
    {
      initials: 'CV',
      name: 'Ms. Carla Vega',
      section: 'BSIS 4A',
      students: 24,
      completion: 78,
      avatarBg: 'bg-teal-600 text-white',
      barColor: 'bg-[#f59e0b]'
    },
    {
      initials: 'JR',
      name: 'Engr. Jose Ramos',
      section: 'BSCE 4A',
      students: 20,
      completion: 95,
      avatarBg: 'bg-emerald-600 text-white',
      barColor: 'bg-emerald-500'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      text: 'Dr. Ana Reyes approved 3 student documents',
      time: '30 mins ago',
      dotColor: 'bg-emerald-500'
    },
    {
      id: 2,
      text: 'Prof. Mark Lim submitted midterm evaluation batch',
      time: '1 hour ago',
      dotColor: 'bg-[#1a1642]'
    },
    {
      id: 3,
      text: 'Engr. Jose Ramos updated company endorsement list',
      time: '3 hours ago',
      dotColor: 'bg-[#f59e0b]'
    }
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      
      {/* USTeP-Themed Header */}
      <header className="bg-[#1a1642] border-b-2 border-[#f59e0b] px-6 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onOpenSidebar && (
              <button 
                onClick={onOpenSidebar}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  Department Overview
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <Shield className="w-3 h-3" /> DEAN PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Welcome back, <span className="text-[#f59e0b] font-medium">Dr. Maria Santos</span> · Department Chair · CITE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate && onNavigate('notifications')}
              className="relative p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full">
                4
              </span>
            </button>
            <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow">
              DS
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* 4 Stat Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {stat.title}
                  </span>
                  <div className={`p-2.5 rounded-xl ${stat.iconBg}`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-[#1a1642]">
                    {stat.value}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {stat.subtitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

       {/* Overall Department Completion Banner */}
        <div className="bg-[#1a1642] rounded-2xl p-5 text-white shadow-lg flex items-center gap-5 border border-[#f59e0b]/30">
          {/* Icon */}
          <div className="p-3 bg-white/10 rounded-xl flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-[#f59e0b]" />
          </div>

          {/* Full-width Middle Section */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-wide text-white block mb-2">
              Department OJT Completion Rate
            </span>
            {/* Full width Progress Bar */}
            <div className="w-full bg-white/15 h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#f59e0b] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: '88%' }}
              />
            </div>
          </div>

          {/* Percentage Stats */}
          <div className="flex flex-col items-end flex-shrink-0 pl-4">
            <span className="text-3xl font-black text-[#f59e0b] leading-none">88%</span>
            <span className="text-xs text-slate-300 font-medium mt-1">overall completion</span>
          </div>
        </div>

        {/* 2-Column Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Columns: Coordinators Overview Table & Activity */}
          <div className="lg:col-span-2 space-y-6">

            {/* Coordinator Overview Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider">
                    Coordinator Overview
                  </h2>
                  <p className="text-xs text-slate-400">Monitoring performance per program section</p>
                </div>
                <button 
                  onClick={() => onNavigate && onNavigate('coordinators')}
                  className="text-xs font-semibold text-[#1a1642] hover:text-[#f59e0b] transition-colors flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase font-semibold">
                      <th className="pb-3 font-medium">Coordinator</th>
                      <th className="pb-3 font-medium">Section</th>
                      <th className="pb-3 font-medium">Students</th>
                      <th className="pb-3 font-medium">Completion</th>
                      <th className="pb-3 font-medium text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {coordinators.map((c, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => onNavigate && onNavigate('coordinators')}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 pr-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shadow-sm ${c.avatarBg}`}>
                              {c.initials}
                            </div>
                            <span className="font-semibold text-slate-800 group-hover:text-[#1a1642]">
                              {c.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-600 font-medium">
                          {c.section}
                        </td>
                        <td className="py-3.5 px-3 text-xs font-bold text-slate-700">
                          {c.students}
                        </td>
                        <td className="py-3.5 px-3 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${c.barColor}`}
                                style={{ width: `${c.completion}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600 font-semibold">{c.completion}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 pl-3 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1a1642] inline-block transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4">
                Recent Activity
              </h2>

              <div className="space-y-4">
                {recentActivity.map((act) => (
                  <div key={act.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-none">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${act.dotColor} flex-shrink-0`} />
                      <span className="text-slate-700 font-medium">{act.text}</span>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      {act.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Quick Access & Department Status */}
          <div className="space-y-6">

            {/* Quick Access Grid */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4">
                Quick Access
              </h2>
              <div className="space-y-3">
                <button 
                  onClick={() => onNavigate && onNavigate('coordinators')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-[#f59e0b] hover:bg-slate-50 transition-all text-left group"
                >
                  <div className="p-2.5 bg-[#f59e0b]/15 text-[#f59e0b] rounded-xl group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642]">Coordinators</h4>
                    <p className="text-[11px] text-slate-400">View details & students</p>
                  </div>
                </button>

                <button 
                  onClick={() => onNavigate && onNavigate('analytics')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-[#1a1642] hover:bg-slate-50 transition-all text-left group"
                >
                  <div className="p-2.5 bg-[#1a1642]/10 text-[#1a1642] rounded-xl group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642]">Analytics</h4>
                    <p className="text-[11px] text-slate-400">Department performance</p>
                  </div>
                </button>

                <button 
                  onClick={() => onNavigate && onNavigate('notifications')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-red-400 hover:bg-slate-50 transition-all text-left group"
                >
                  <div className="p-2.5 bg-red-50 text-red-500 rounded-xl group-hover:scale-105 transition-transform">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-red-500">Notifications</h4>
                    <p className="text-[11px] text-slate-400">4 unread alerts</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Department Status Summary Card */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-[#1a1642] uppercase tracking-wider mb-3">
                Department Status
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Active students</span>
                  <span className="font-bold text-[#1a1642]">114 / 128</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Avg completion</span>
                  <span className="font-bold text-emerald-600">88%</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Coordinators</span>
                  <span className="font-bold text-[#f59e0b]">4 active</span>
                </div>
              </div>
            </div>

            {/* Read-Only Access Notice */}
            <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="p-2 bg-[#1a1642]/10 rounded-xl text-[#1a1642]">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Read-only access</span>
                <span className="text-[11px] text-slate-500">Monitoring role only</span>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Floating Help Button */}
      <button className="fixed bottom-6 right-6 p-3 bg-white text-[#1a1642] rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-all">
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
}