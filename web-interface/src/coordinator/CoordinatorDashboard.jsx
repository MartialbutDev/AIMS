import React from 'react';
import {
  Menu,
  Bell,
  Users,
  Building2,
  FileText,
  Award,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CoordinatorDashboard({ onOpenSidebar, onNavigate, onLogout }) {
  const navigate = useNavigate();

  const handleTabSwitch = (target) => {
    if (onNavigate) {
      onNavigate(target);
    }
    if (target.startsWith('/')) {
      navigate(target);
    } else {
      navigate(`/coordinator/${target.toLowerCase()}`);
    }
  };

  // Top metric counters
  const stats = [
    {
      title: 'TOTAL STUDENTS',
      value: 6,
      subtitle: '5 active, 1 pending',
      icon: Users,
      iconBg: 'bg-[#1a1642]/10',
      iconColor: 'text-[#1a1642]',
      target: '/coordinator/students'
    },
    {
      title: 'PARTNER COMPANIES',
      value: 3,
      subtitle: '23 total slots',
      icon: Building2,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#d97706]',
      target: '/coordinator/companies'
    },
    {
      title: 'PENDING REPORTS',
      value: 3,
      subtitle: 'Requires review',
      icon: FileText,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#b45309]',
      target: '/coordinator/reports'
    },
    {
      title: 'PENDING EVALUATIONS',
      value: 5,
      subtitle: '1 fully complete',
      icon: Award,
      iconBg: 'bg-[#1a1642]/10',
      iconColor: 'text-[#1a1642]',
      target: '/coordinator/evaluations'
    }
  ];

  // Recent activity list
  const recentActivities = [
    {
      id: 1,
      name: 'John Dela Cruz',
      desc: 'Submitted Weekly Report #12',
      time: '10 mins ago',
      dotColor: 'bg-[#f59e0b]'
    },
    {
      id: 2,
      name: 'Maria Santos',
      desc: 'Logged attendance',
      time: '25 mins ago',
      dotColor: 'bg-[#1a1642]'
    },
    {
      id: 3,
      name: 'Robert Chen',
      desc: 'Uploaded document',
      time: '1 hour ago',
      dotColor: 'bg-[#d97706]'
    },
    {
      id: 4,
      name: 'Lisa Garcia',
      desc: 'Completed evaluation',
      time: '2 hours ago',
      dotColor: 'bg-[#f59e0b]'
    },
    {
      id: 5,
      name: 'Michael Tan',
      desc: 'Submitted Weekly Report #11',
      time: '3 hours ago',
      dotColor: 'bg-[#1a1642]'
    }
  ];

  // Student progress rows with USTP navy/mustard accents
  const studentsProgress = [
    {
      id: 'JD',
      name: 'John Dela Cruz',
      percent: 48,
      hours: '240/500 hrs',
      barColor: 'bg-[#f59e0b]',
      status: 'on track',
      statusClass: 'bg-amber-50 text-[#b45309] border border-amber-200'
    },
    {
      id: 'MS',
      name: 'Maria Santos',
      percent: 64,
      hours: '320/500 hrs',
      barColor: 'bg-[#1a1642]',
      status: 'excellent',
      statusClass: 'bg-[#1a1642]/10 text-[#1a1642] border border-[#1a1642]/20'
    },
    {
      id: 'MT',
      name: 'Michael Tan',
      percent: 90,
      hours: '450/500 hrs',
      barColor: 'bg-[#d97706]',
      status: 'excellent',
      statusClass: 'bg-[#1a1642]/10 text-[#1a1642] border border-[#1a1642]/20'
    },
    {
      id: 'RC',
      name: 'Robert Chen',
      percent: 36,
      hours: '180/500 hrs',
      barColor: 'bg-[#f59e0b]',
      status: 'on track',
      statusClass: 'bg-amber-50 text-[#b45309] border border-amber-200'
    }
  ];

  return (
    <div className="relative z-10 min-h-screen bg-transparent text-slate-800 font-sans pb-16">
      {/* USTP Navy Header with Mustard accent border */}
      <header className="bg-[#1a1642] border-b-2 border-[#f59e0b] px-6 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onOpenSidebar && (
              <button
                type="button"
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
                  Coordinator Dashboard
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <GraduationCap className="w-3 h-3" /> USTP OJT PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Welcome back, Dr. Ana Reyes · College of Information Technology
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleTabSwitch('/coordinator/profile')}
              className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow hover:bg-[#d97706] transition-colors cursor-pointer"
              title="View Profile"
            >
              AR
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
            Overview
          </h2>
          <p className="text-xs text-slate-200 mt-0.5 drop-shadow-xs">
            Monitor and coordinate student internships and submissions
          </p>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                onClick={() => handleTabSwitch(stat.target)}
                className="bg-white/95 backdrop-blur-md rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#f59e0b]/60 transition-all cursor-pointer group select-none"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-[#1a1642] transition-colors">
                    {stat.title}
                  </span>
                  <div className={`p-2.5 rounded-xl ${stat.iconBg}`}>
                    <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-[#1a1642]">
                    {stat.value}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {stat.subtitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall OJT Progress Banner in USTP Dark Navy and Mustard Gold */}
        <div className="bg-[#1a1642] border-2 border-[#f59e0b]/60 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">
                Overall OJT Progress — All Students
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Cohort milestone tracking for current academic term
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="w-full bg-white/15 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="bg-[#f59e0b] h-full rounded-full transition-all duration-700 shadow-sm"
                style={{ width: '67%' }}
              />
            </div>
            <div className="text-right whitespace-nowrap">
              <span className="text-lg font-black text-[#f59e0b]">67%</span>
              <span className="text-[11px] text-slate-300 block">on track</span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ======================================================== */}
          {/* LEFT COLUMN: Recent Activity + Student Progress          */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. RECENT ACTIVITY */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-[#1a1642] uppercase tracking-wider">
                  Recent Activity
                </h3>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('/coordinator/students')}
                  className="text-xs font-semibold text-[#b45309] hover:text-[#d97706] hover:underline cursor-pointer"
                >
                  View all students
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {recentActivities.map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full ${act.dotColor} mt-1.5 flex-shrink-0`} />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">
                          {act.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {act.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{act.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. STUDENT PROGRESS */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-[#1a1642] uppercase tracking-wider">
                  Student Progress
                </h3>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('/coordinator/students')}
                  className="text-xs font-semibold text-[#b45309] hover:text-[#d97706] hover:underline cursor-pointer"
                >
                  View full list
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                      <th className="pb-3 pl-2">Student</th>
                      <th className="pb-3 px-3 min-w-[140px]">Progress</th>
                      <th className="pb-3 px-3">Hours</th>
                      <th className="pb-3 pr-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentsProgress.map((st) => (
                      <tr
                        key={st.id}
                        onClick={() => handleTabSwitch('/coordinator/students')}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 pl-2 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#1a1642]/10 text-[#1a1642] font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                              {st.id}
                            </div>
                            <span className="font-semibold text-slate-800 text-xs group-hover:text-[#b45309] transition-colors">
                              {st.name}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${st.barColor}`}
                                style={{ width: `${st.percent}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {st.percent}%
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px]">
                          {st.hours}
                        </td>

                        <td className="py-3.5 pr-2 text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${st.statusClass}`}
                          >
                            {st.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: Quick Actions + Reminder + Pending Actions */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. QUICK ACTIONS */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-bold text-[#1a1642] uppercase tracking-wider">
                Quick Actions
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Review Reports */}
                <button
                  type="button"
                  onClick={() => handleTabSwitch('/coordinator/reports')}
                  className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-slate-200/80 hover:border-[#f59e0b] hover:bg-[#fffdf5] transition-all cursor-pointer group shadow-2xs active:scale-95"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#f59e0b]/15 text-[#b45309] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform pointer-events-none">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#b45309] pointer-events-none">
                    Review Reports
                  </span>
                </button>

                {/* Assign Companies */}
                <button
                  type="button"
                  onClick={() => handleTabSwitch('/coordinator/companies')}
                  className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-slate-200/80 hover:border-[#1a1642] hover:bg-slate-50 transition-all cursor-pointer group shadow-2xs active:scale-95"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#1a1642]/10 text-[#1a1642] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform pointer-events-none">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642] pointer-events-none">
                    Assign Companies
                  </span>
                </button>

                {/* Announcements */}
                <button
                  type="button"
                  onClick={() => handleTabSwitch('/coordinator/announcements')}
                  className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-slate-200/80 hover:border-[#f59e0b] hover:bg-[#fffdf5] transition-all cursor-pointer group shadow-2xs active:scale-95"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#f59e0b]/15 text-[#f59e0b] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform pointer-events-none">
                    <Bell className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#b45309] pointer-events-none">
                    Announcements
                  </span>
                </button>

                {/* Evaluations */}
                <button
                  type="button"
                  onClick={() => handleTabSwitch('/coordinator/evaluations')}
                  className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-slate-200/80 hover:border-[#1a1642] hover:bg-slate-50 transition-all cursor-pointer group shadow-2xs active:scale-95"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#1a1642]/10 text-[#1a1642] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform pointer-events-none">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642] pointer-events-none">
                    Evaluations
                  </span>
                </button>
              </div>
            </div>

            {/* 2. REMINDER CARD - USTP Mustard Gold styling */}
            <div className="bg-[#fffdf5]/95 backdrop-blur-md rounded-2xl border-2 border-[#f59e0b]/50 p-5 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-[#b45309] font-bold text-xs">
                <Bell className="w-4 h-4 text-[#f59e0b]" />
                <span>Reminder</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Mid-term evaluations are due in 5 days. 8 students pending review.
              </p>
              <button
                type="button"
                onClick={() => handleTabSwitch('/coordinator/evaluations')}
                className="text-xs font-bold text-[#b45309] hover:text-[#d97706] inline-flex items-center gap-1 pt-1 cursor-pointer"
              >
                Go to Evaluations →
              </button>
            </div>

            {/* 3. PENDING ACTIONS CARD */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#1a1642] font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#f59e0b]" />
                <span>Pending Actions</span>
              </div>

              <div className="space-y-2 text-xs">
                <div
                  onClick={() => handleTabSwitch('/coordinator/reports')}
                  className="flex items-center justify-between py-1.5 border-b border-slate-100 hover:text-[#b45309] cursor-pointer transition-colors"
                >
                  <span className="text-slate-600 font-medium">Reports to review</span>
                  <span className="font-bold text-[#b45309] font-mono text-xs">12</span>
                </div>

                <div
                  onClick={() => handleTabSwitch('/coordinator/students')}
                  className="flex items-center justify-between py-1.5 border-b border-slate-100 hover:text-[#1a1642] cursor-pointer transition-colors"
                >
                  <span className="text-slate-600 font-medium">Documents pending</span>
                  <span className="font-bold text-[#1a1642] font-mono text-xs">4</span>
                </div>

                <div
                  onClick={() => handleTabSwitch('/coordinator/evaluations')}
                  className="flex items-center justify-between py-1.5 hover:text-[#b45309] cursor-pointer transition-colors"
                >
                  <span className="text-slate-600 font-medium">Evaluations due</span>
                  <span className="font-bold text-[#d97706] font-mono text-xs">8</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}