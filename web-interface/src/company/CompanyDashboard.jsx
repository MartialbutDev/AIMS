import React from 'react';
import {
  Menu,
  Users,
  FileText,
  Clock,
  Award,
  TrendingUp,
  Bell,
  ChevronRight,
  HelpCircle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function CompanyDashboard({ onNavigate, onOpenSidebar }) {
  // Top 4 Metric Cards styled consistently with Dean/Coordinator
  const stats = [
    {
      title: 'MY STUDENTS',
      value: '5',
      subtitle: 'Active interns',
      icon: Users,
      iconBg: 'bg-[#1a1642]/10',
      iconColor: 'text-[#1a1642]'
    },
    {
      title: 'PENDING REVIEWS',
      value: '3',
      subtitle: 'Need feedback',
      icon: FileText,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#f59e0b]'
    },
    {
      title: 'HOURS THIS WEEK',
      value: '187',
      subtitle: 'Total logged',
      icon: Clock,
      iconBg: 'bg-[#1a1642]/10',
      iconColor: 'text-[#1a1642]'
    },
    {
      title: 'EVALUATIONS DUE',
      value: '2',
      subtitle: 'This month',
      icon: Award,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#f59e0b]'
    }
  ];

  // Interns list with unified Gold progress bars & Navy badges
  const students = [
    {
      initials: 'JD',
      name: 'John Dela Cruz',
      actionNote: 'Logged attendance – 2h ago',
      hours: '240/500 hrs',
      percentage: 48,
      status: 'on-track',
      statusClass: 'bg-[#f59e0b]/15 text-[#b45309] border border-[#f59e0b]/30',
      avatarBg: 'bg-[#1a1642] text-[#f59e0b]',
      barColor: 'bg-[#f59e0b]'
    },
    {
      initials: 'MS',
      name: 'Maria Santos',
      actionNote: 'Submitted report – 1d ago',
      hours: '320/500 hrs',
      percentage: 64,
      status: 'on-track',
      statusClass: 'bg-[#1a1642]/10 text-[#1a1642] border border-[#1a1642]/20',
      avatarBg: 'bg-[#1a1642] text-[#f59e0b]',
      barColor: 'bg-[#f59e0b]'
    },
    {
      initials: 'RC',
      name: 'Robert Chen',
      actionNote: 'Logged attendance – 5h ago',
      hours: '180/500 hrs',
      percentage: 36,
      status: 'on-track',
      statusClass: 'bg-[#f59e0b]/15 text-[#b45309] border border-[#f59e0b]/30',
      avatarBg: 'bg-[#1a1642] text-[#f59e0b]',
      barColor: 'bg-[#f59e0b]'
    }
  ];

  const recentActivity = [
    { id: 1, name: 'John Dela Cruz', action: 'Submitted Weekly Report #12', time: '2 hours ago', dotColor: 'bg-[#f59e0b]' },
    { id: 2, name: 'Maria Santos', action: 'Logged attendance (9 hours)', time: '5 hours ago', dotColor: 'bg-[#1a1642]' },
    { id: 3, name: 'Robert Chen', action: 'Completed task: API Integration', time: '1 day ago', dotColor: 'bg-[#f59e0b]' },
    { id: 4, name: 'John Dela Cruz', action: 'Updated task progress', time: '1 day ago', dotColor: 'bg-[#1a1642]' }
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      
      {/* USTeP Navy Header with Gold Badge & Avatar */}
      <header className="bg-[#1a1642] border-b-2 border-[#f59e0b] px-6 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSidebar}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  Dashboard
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <Building2 className="w-3 h-3" /> HOST COMPANY
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Welcome back, <span className="text-[#f59e0b] font-medium">Maria Santos</span> · Senior Developer · TechVision Solutions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate && onNavigate('company-notifications')}
              className="relative p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full">
                3
              </span>
            </button>
            <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow">
              MS
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white/95 backdrop-blur-md rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow"
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

        {/* Elongated Navy Banner with Gold Fill Bar */}
        <div className="bg-[#1a1642] rounded-2xl p-5 text-white shadow-lg flex items-center gap-5 border border-[#f59e0b]/30">
          <div className="p-3 bg-white/10 rounded-xl flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-[#f59e0b]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold tracking-wide text-white">
                Team Performance — All interns on track
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-300">
                • 3 active interns • 187 total hours this week
              </span>
            </div>
            <div className="w-full bg-white/15 h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#f59e0b] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="flex flex-col items-end flex-shrink-0 pl-4">
            <span className="text-3xl font-black text-[#f59e0b] leading-none">100%</span>
            <span className="text-xs text-slate-300 font-medium mt-1">on track</span>
          </div>
        </div>

        {/* 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">

            {/* My Students */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider">
                  My Students
                </h2>
                <button
                  onClick={() => onNavigate && onNavigate('company-students')}
                  className="text-xs font-semibold text-[#1a1642] hover:text-[#f59e0b] transition-colors"
                >
                  View all
                </button>
              </div>

              <div className="space-y-4">
                {students.map((student, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shadow-xs ${student.avatarBg}`}>
                          {student.initials}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 text-sm">{student.name}</h4>
                          <p className="text-xs text-slate-400">{student.actionNote}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${student.statusClass}`}>
                        {student.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{student.hours}</span>
                        <span className="font-semibold text-slate-700">{student.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${student.barColor}`}
                          style={{ width: `${student.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4">
                Recent Activity
              </h2>

              <div className="space-y-4">
                {recentActivity.map((act) => (
                  <div key={act.id} className="flex items-start justify-between py-2 border-b border-slate-100 last:border-none">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${act.dotColor} flex-shrink-0 mt-1`} />
                      <div>
                        <span className="font-semibold text-sm text-slate-800">{act.name}</span>
                        <p className="text-xs text-slate-500">{act.action}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{act.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Quick Actions, Reminder & Pending */}
          <div className="space-y-6">

            {/* Quick Actions */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4">
                Quick Actions
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onNavigate && onNavigate('company-reports')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-[#1a1642]/10 text-[#1a1642] rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-[#1a1642]">Review Reports</span>
                </button>

                <button
                  onClick={() => onNavigate && onNavigate('company-attendance')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-[#f59e0b]/15 text-[#f59e0b] rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-[#1a1642]">Attendance Log</span>
                </button>

                <button
                  onClick={() => onNavigate && onNavigate('company-evaluations')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-[#f59e0b]/15 text-[#f59e0b] rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-[#1a1642]">Give Feedback</span>
                </button>

                <button
                  onClick={() => onNavigate && onNavigate('company-students')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-[#1a1642]/10 text-[#1a1642] rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-[#1a1642]">My Students</span>
                </button>
              </div>
            </div>

            {/* Evaluations Due Reminder (Gold/Amber Theme) */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-2">
                <Award className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Evaluations Due</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    2 student evaluations are due by April 30, 2026. Submit feedback before the deadline.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate && onNavigate('company-evaluations')}
                className="mt-3 text-xs font-bold text-[#1a1642] hover:text-[#f59e0b] flex items-center gap-1 transition-colors ml-8"
              >
                Go to Evaluations <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Pending Actions */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#f59e0b]" />
                Pending Actions
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Reports to review</span>
                  <span className="font-bold text-[#1a1642] bg-[#1a1642]/10 px-2 py-0.5 rounded-full">3</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Evaluations due</span>
                  <span className="font-bold text-[#f59e0b] bg-[#f59e0b]/15 px-2 py-0.5 rounded-full">2</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-slate-600 font-medium">Late arrivals today</span>
                  <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">1</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>

      <button className="fixed bottom-6 right-6 p-3 bg-white text-[#1a1642] rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-all">
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
}