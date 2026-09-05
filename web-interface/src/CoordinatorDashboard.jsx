import React from 'react';
import {
  Menu,
  Users,
  Building2,
  FileText,
  Award,
  TrendingUp,
  Bell,
  Clock,
  ChevronRight,
  HelpCircle,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function CoordinatorDashboard({ onNavigate, onOpenSidebar }) {
  // Top 4 Metric Cards
  const stats = [
    {
      title: 'TOTAL STUDENTS',
      value: '48',
      subtitle: '+3 this week',
      icon: Users,
      iconBg: 'bg-[#1a1642]/10',
      iconColor: 'text-[#1a1642]'
    },
    {
      title: 'ACTIVE INTERNSHIPS',
      value: '42',
      subtitle: '87% active',
      icon: Building2,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600'
    },
    {
      title: 'PENDING REPORTS',
      value: '12',
      subtitle: 'Need review',
      icon: FileText,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#f59e0b]'
    },
    {
      title: 'PENDING EVALUATIONS',
      value: '8',
      subtitle: 'Due soon',
      icon: Award,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600'
    }
  ];

  // Recent Activity Feed
  const recentActivity = [
    { id: 1, name: 'John Dela Cruz', action: 'Submitted Weekly Report #12', time: '10 mins ago', dotColor: 'bg-emerald-500' },
    { id: 2, name: 'Maria Santos', action: 'Logged attendance', time: '25 mins ago', dotColor: 'bg-[#1a1642]' },
    { id: 3, name: 'Robert Chen', action: 'Uploaded document', time: '1 hour ago', dotColor: 'bg-purple-500' },
    { id: 4, name: 'Lisa Garcia', action: 'Completed evaluation', time: '2 hours ago', dotColor: 'bg-[#f59e0b]' },
    { id: 5, name: 'Michael Tan', action: 'Submitted Weekly Report #11', time: '3 hours ago', dotColor: 'bg-emerald-500' }
  ];

  // Student Progress Data
  const studentProgress = [
    {
      initials: 'JD',
      name: 'John Dela Cruz',
      progress: 48,
      hours: '240/500 hrs',
      status: 'on track',
      statusType: 'neutral',
      barColor: 'bg-[#f59e0b]',
      avatarBg: 'bg-[#1a1642] text-[#f59e0b]'
    },
    {
      initials: 'MS',
      name: 'Maria Santos',
      progress: 64,
      hours: '320/500 hrs',
      status: 'excellent',
      statusType: 'success',
      barColor: 'bg-emerald-500',
      avatarBg: 'bg-purple-600 text-white'
    },
    {
      initials: 'MT',
      name: 'Michael Tan',
      progress: 90,
      hours: '450/500 hrs',
      status: 'excellent',
      statusType: 'success',
      barColor: 'bg-emerald-500',
      avatarBg: 'bg-teal-600 text-white'
    },
    {
      initials: 'RC',
      name: 'Robert Chen',
      progress: 36,
      hours: '180/500 hrs',
      status: 'on track',
      statusType: 'neutral',
      barColor: 'bg-[#f59e0b]',
      avatarBg: 'bg-slate-700 text-white'
    }
  ];

  return (
   <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      
      {/* USTeP Header with Hamburger Menu */}
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
                  Coordinator Dashboard
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <ShieldCheck className="w-3 h-3" /> COORDINATOR PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Welcome back, <span className="text-[#f59e0b] font-medium">Dr. Ana Reyes</span> · OJT Coordinator · BSIT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate && onNavigate('coordinator-announcements')}
              className="relative p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full">
                5
              </span>
            </button>
            <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow">
              AR
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* 4 Top Metric Cards */}
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

        {/* Elongated USTeP Progress Banner */}
        <div className="bg-[#1a1642] rounded-2xl p-5 text-white shadow-lg flex items-center gap-5 border border-[#f59e0b]/30">
          <div className="p-3 bg-white/10 rounded-xl flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-[#f59e0b]" />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-wide text-white block mb-2">
              Overall OJT Progress — All Students
            </span>
            <div className="w-full bg-white/15 h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#f59e0b] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: '87%' }}
              />
            </div>
          </div>

          <div className="flex flex-col items-end flex-shrink-0 pl-4">
            <span className="text-3xl font-black text-[#f59e0b] leading-none">87%</span>
            <span className="text-xs text-slate-300 font-medium mt-1">on track</span>
          </div>
        </div>

        {/* 2-Column Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (2 Cols wide): Recent Activity & Student Progress */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Recent Activity Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider">
                  Recent Activity
                </h2>
                <button 
                  onClick={() => onNavigate && onNavigate('coordinator-students')}
                  className="text-xs font-semibold text-[#1a1642] hover:text-[#f59e0b] transition-colors"
                >
                  View all students
                </button>
              </div>

              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-none">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${activity.dotColor} flex-shrink-0`} />
                      <div>
                        <span className="font-semibold text-slate-800">{activity.name}</span>
                        <p className="text-xs text-slate-500">{activity.action}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Student Progress Table Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider">
                    Student Progress
                  </h2>
                  <p className="text-xs text-slate-400">Section BSIT 4A & 4B</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase font-semibold">
                      <th className="pb-3 font-medium">Student</th>
                      <th className="pb-3 font-medium">Progress</th>
                      <th className="pb-3 font-medium">Hours</th>
                      <th className="pb-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentProgress.map((student, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pr-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shadow-sm ${student.avatarBg}`}>
                              {student.initials}
                            </div>
                            <span className="font-semibold text-slate-800">{student.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${student.barColor}`}
                                style={{ width: `${student.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600 font-semibold">{student.progress}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-600 font-medium">
                          {student.hours}
                        </td>
                        <td className="py-3.5 pl-3 text-right">
                          <span
                            className={`inline-block px-2.5 py-1 text-xs rounded-full font-medium ${
                              student.statusType === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30'
                            }`}
                          >
                            {student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Quick Actions, Reminder & Pending Actions */}
          <div className="space-y-6">

            {/* Quick Actions Grid */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => onNavigate && onNavigate('coordinator-reports')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Review Reports</span>
                </button>

                <button 
                  onClick={() => onNavigate && onNavigate('coordinator-companies')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Assign Companies</span>
                </button>

                <button 
                  onClick={() => onNavigate && onNavigate('coordinator-announcements')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-[#f59e0b]/15 text-[#f59e0b] rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <Bell className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Announcements</span>
                </button>

                <button 
                  onClick={() => onNavigate && onNavigate('coordinator-evaluations')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-[#f59e0b] hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-[#1a1642]/10 text-[#1a1642] rounded-xl mb-2 group-hover:scale-110 transition-transform">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Evaluations</span>
                </button>
              </div>
            </div>

            {/* Reminder Card */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Reminder</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Mid-term evaluations are due in 5 days. 8 students pending review.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => onNavigate && onNavigate('coordinator-evaluations')}
                className="mt-3 text-xs font-bold text-[#1a1642] hover:text-[#f59e0b] flex items-center gap-1 transition-colors ml-8"
              >
                Go to Evaluations <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pending Actions Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Pending Actions
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Reports to review</span>
                  <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">12</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Documents pending</span>
                  <span className="font-bold text-[#1a1642] bg-slate-100 px-2 py-0.5 rounded-full">4</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-slate-600 font-medium">Evaluations due</span>
                  <span className="font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full">8</span>
                </div>
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