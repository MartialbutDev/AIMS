import React from 'react';
import {
  Menu,
  FileCheck,
  Clock,
  RefreshCw,
  Users,
  TrendingUp,
  Bell,
  Building2,
  FileText,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  HelpCircle,
  Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CareerCenterDashboard({ onOpenSidebar, onLogout }) {
  const navigate = useNavigate();

  const stats = [
    {
      title: 'Active MOAs',
      value: '3',
      subtitle: '60 total slots available',
      icon: FileCheck,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600'
    },
    {
      title: 'Pending Approval',
      value: '2',
      subtitle: 'Awaiting signatures',
      icon: Clock,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#f59e0b]'
    },
    {
      title: 'Under Review',
      value: '2',
      subtitle: 'Amendment requests',
      icon: RefreshCw,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Students Placed',
      value: '5',
      subtitle: '2 completed this term',
      icon: Users,
      iconBg: 'bg-[#1a1642]/10',
      iconColor: 'text-[#1a1642]'
    }
  ];

  const partnerCompanies = [
    {
      id: 1,
      name: 'TechVision Solutions Inc.',
      industry: 'Information Technology',
      placed: '12/15',
      status: 'Active',
      statusClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    },
    {
      id: 2,
      name: 'Globe Telecom PH',
      industry: 'Telecommunications',
      placed: '18/20',
      status: 'Active',
      statusClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    },
    {
      id: 3,
      name: 'BDO Unibank Inc.',
      industry: 'Banking & Finance',
      placed: '20/25',
      status: 'Active',
      statusClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    },
    {
      id: 4,
      name: 'Digital Innovations Corp.',
      industry: 'Software Development',
      placed: '0/10',
      status: 'Pending',
      statusClass: 'bg-[#f59e0b]/15 text-[#b45309] border border-[#f59e0b]/30'
    },
    {
      id: 5,
      name: 'PhilCare Medical Group',
      industry: 'Healthcare',
      placed: '0/8',
      status: 'Pending',
      statusClass: 'bg-[#f59e0b]/15 text-[#b45309] border border-[#f59e0b]/30'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      name: 'TechVision Solutions',
      action: 'submitted updated training plan',
      time: '2 hours ago',
      dotColor: 'bg-[#1a1642]'
    },
    {
      id: 2,
      name: 'Globe Telecom MOA',
      action: 'expires in 14 days — renewal pending',
      time: 'Today',
      dotColor: 'bg-red-500'
    },
    {
      id: 3,
      name: '3 new students',
      action: 'placed at BDO Unibank for Summer 2026',
      time: 'Yesterday',
      dotColor: 'bg-emerald-500'
    },
    {
      id: 4,
      name: 'Ayala Land Inc.',
      action: 'requested MOA amendment review',
      time: '2 days ago',
      dotColor: 'bg-purple-500'
    },
    {
      id: 5,
      name: 'Digital Innovations Corp.',
      action: 'pending MOA — awaiting notarization',
      time: '3 days ago',
      dotColor: 'bg-[#f59e0b]'
    }
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
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
                  Career Center Overview
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <Briefcase className="w-3 h-3" /> CAREER PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-300">
                MOA & Partnership Management · Academic Year 2025–2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/career-center/notifications')}
              className="relative p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full">
                4
              </span>
            </button>
            <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow">
              CC
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
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

        <div className="bg-[#1a1642] rounded-2xl p-5 text-white shadow-lg flex items-center gap-5 border border-[#f59e0b]/30">
          <div className="p-3 bg-white/10 rounded-xl flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-[#f59e0b]" />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-wide text-white block mb-2">
              Student Placement Rate — Summer 2026
            </span>
            <div className="w-full bg-white/15 h-3 rounded-full overflow-hidden">
              <div
                className="bg-[#f59e0b] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: '83%' }}
              />
            </div>
          </div>

          <div className="flex flex-col items-end flex-shrink-0 pl-4">
            <span className="text-3xl font-black text-[#f59e0b] leading-none">83%</span>
            <span className="text-xs text-slate-300 font-medium mt-1">50/60 slots filled</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider">
                  Partner Companies
                </h2>
                <button
                  onClick={() => navigate('/career-center/partners')}
                  className="text-xs font-semibold text-[#1a1642] hover:text-[#f59e0b] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase font-semibold">
                      <th className="pb-3 font-medium">Company</th>
                      <th className="pb-3 font-medium">Industry</th>
                      <th className="pb-3 font-medium">Placed</th>
                      <th className="pb-3 font-medium text-center">MOA Status</th>
                      <th className="pb-3 font-medium text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partnerCompanies.map((company) => (
                      <tr
                        key={company.id}
                        onClick={() => navigate('/career-center/partners')}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#1a1642]/10 text-[#1a1642] flex items-center justify-center shadow-xs">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-slate-800 group-hover:text-[#1a1642]">
                              {company.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-600 font-medium">
                          {company.industry}
                        </td>
                        <td className="py-3.5 px-3 text-xs font-bold text-slate-700">
                          {company.placed}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full font-medium ${company.statusClass}`}>
                            {company.status}
                          </span>
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

            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4">
                Recent Activity
              </h2>

              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-none">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${activity.dotColor} flex-shrink-0`} />
                      <div>
                        <span className="font-semibold text-slate-800">{activity.name}</span>{' '}
                        <span className="text-xs text-slate-500">{activity.action}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm font-bold text-[#1a1642] uppercase tracking-wider mb-4">
                Quick Access
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/career-center/partners')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-[#f59e0b] hover:bg-slate-50 transition-all text-left group cursor-pointer"
                >
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642]">Partner Companies</h4>
                    <p className="text-[11px] text-slate-400">8 total partners</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/career-center/placements')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-[#1a1642] hover:bg-slate-50 transition-all text-left group cursor-pointer"
                >
                  <div className="p-2.5 bg-[#1a1642]/10 text-[#1a1642] rounded-xl group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642]">Students Placed</h4>
                    <p className="text-[11px] text-slate-400">5 active placements</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/career-center/documents')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-purple-400 hover:bg-slate-50 transition-all text-left group cursor-pointer"
                >
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642]">Documents</h4>
                    <p className="text-[11px] text-slate-400">3 pending review</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/career-center/reports')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-[#f59e0b] hover:bg-slate-50 transition-all text-left group cursor-pointer"
                >
                  <div className="p-2.5 bg-[#f59e0b]/15 text-[#f59e0b] rounded-xl group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#1a1642]">Reports</h4>
                    <p className="text-[11px] text-slate-400">Analytics & summaries</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                <h3 className="text-xs font-bold text-[#1a1642] uppercase tracking-wider">
                  Expiring Soon
                </h3>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Globe Telecom PH</span>
                  <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">14d</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">BDO Unibank Inc.</span>
                  <span className="font-bold text-[#f59e0b] bg-[#f59e0b]/15 px-2 py-0.5 rounded-md border border-[#f59e0b]/30">65d</span>
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