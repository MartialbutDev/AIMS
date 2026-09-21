import React, { useState } from 'react';
import {
  Search,
  Download,
  Menu,
  ChevronRight,
  Briefcase,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const studentsData = [
  {
    id: 'S001',
    initials: 'JD',
    name: 'John Dela Cruz',
    program: 'BSCS',
    company: 'TechVision Solutions...',
    period: 'Jun 1, 2026 – Sep 30, 2026',
    completedHours: 312,
    totalHours: 486,
    coordinator: 'Dr. Ana Reyes',
    status: 'Active'
  },
  {
    id: 'S002',
    initials: 'MS',
    name: 'Maria Santos',
    program: 'BSIT',
    company: 'Globe Telecom PH',
    period: 'Jun 1, 2026 – Sep 30, 2026',
    completedHours: 290,
    totalHours: 486,
    coordinator: 'Dr. Ana Reyes',
    status: 'Active'
  },
  {
    id: 'S003',
    initials: 'RC',
    name: 'Robert Chen',
    program: 'BSCS',
    company: 'TechVision Solutions...',
    period: 'Jun 1, 2026 – Sep 30, 2026',
    completedHours: 340,
    totalHours: 486,
    coordinator: 'Prof. Mark Lim',
    status: 'Active'
  },
  {
    id: 'S004',
    initials: 'LG',
    name: 'Lisa Garcia',
    program: 'BSIT',
    company: 'BDO Unibank Inc.',
    period: 'Jan 15, 2026 – May 15, 2026',
    completedHours: 486,
    totalHours: 486,
    coordinator: 'Dr. Ana Reyes',
    status: 'Completed'
  },
  {
    id: 'S005',
    initials: 'CM',
    name: 'Carlo Mendoza',
    program: 'BSCS',
    company: 'Ayala Land Inc.',
    period: 'Jun 1, 2026 – Sep 30, 2026',
    completedHours: 200,
    totalHours: 486,
    coordinator: 'Ms. Carla Vega',
    status: 'Active'
  },
  {
    id: 'S006',
    initials: 'AC',
    name: 'Angela Cruz',
    program: 'BSIT',
    company: 'BDO Unibank Inc.',
    period: 'Jun 1, 2026 – Sep 30, 2026',
    completedHours: 278,
    totalHours: 486,
    coordinator: 'Dr. Ana Reyes',
    status: 'Active'
  },
  {
    id: 'S007',
    initials: 'JL',
    name: 'James Lim',
    program: 'BSCS',
    company: 'Globe Telecom PH',
    period: 'Jan 10, 2026 – May 10, 2026',
    completedHours: 486,
    totalHours: 486,
    coordinator: 'Prof. Mark Lim',
    status: 'Completed'
  },
  {
    id: 'S008',
    initials: 'PR',
    name: 'Patricia Ramos',
    program: 'BSIS',
    company: 'Awaiting Placement',
    period: 'Pending start',
    completedHours: 0,
    totalHours: 486,
    coordinator: 'Ms. Carla Vega',
    status: 'Pending'
  }
];

export default function StudentsPlacedPage({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filterTabs = ['All', 'Active', 'Completed', 'Pending'];

  const stats = [
    { label: 'Total Enrolled', count: 8, filter: 'All', color: 'text-slate-800' },
    { label: 'Currently Active', count: 5, filter: 'Active', color: 'text-blue-600' },
    { label: 'Completed', count: 2, filter: 'Completed', color: 'text-emerald-600' },
    { label: 'Pending Placement', count: 1, filter: 'Pending', color: 'text-amber-500' }
  ];

  const filteredStudents = studentsData.filter((student) => {
    const matchesFilter = activeFilter === 'All' || student.status === activeFilter;
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.coordinator.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active':
        return 'border border-blue-200 text-blue-600 bg-blue-50';
      case 'Completed':
        return 'border border-emerald-300 text-emerald-600 bg-emerald-50';
      case 'Pending':
        return 'border border-amber-300 text-amber-600 bg-amber-50';
      default:
        return 'border border-slate-200 text-slate-600 bg-slate-50';
    }
  };

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
                aria-label="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  Students Placed
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <Briefcase className="w-3 h-3" /> CAREER PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-300">
                8 students enrolled · 5 currently active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/career-center')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Overview
            </button>
            <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow">
              CC
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Title and Export Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Students Placed</h2>
            <p className="text-xs text-slate-500 mt-0.5">8 students enrolled · 5 currently active</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer">
            <Download className="w-4 h-4 text-slate-600" />
            Export List
          </button>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              onClick={() => setActiveFilter(stat.filter)}
              className={`bg-white/95 backdrop-blur-md rounded-2xl p-5 border shadow-xs cursor-pointer hover:shadow-md transition-all ${
                activeFilter === stat.filter
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                  : 'border-slate-200/80'
              }`}
            >
              <span className={`text-3xl font-extrabold block ${stat.color}`}>
                {stat.count}
              </span>
              <span className="text-xs font-semibold text-slate-500 mt-1 block">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Search, Filter Tabs & Table Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          
          {/* Search Bar and Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search student, company..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1a1642] focus:ring-1 focus:ring-[#1a1642] transition-all bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    activeFilter === tab
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Students Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                  <th className="pb-3.5 pl-2">Student</th>
                  <th className="pb-3.5 px-3">Program</th>
                  <th className="pb-3.5 px-3">Company</th>
                  <th className="pb-3.5 px-3">Period</th>
                  <th className="pb-3.5 px-3 min-w-[130px]">Progress</th>
                  <th className="pb-3.5 px-3">Coordinator</th>
                  <th className="pb-3.5 px-3 text-center">Status</th>
                  <th className="pb-3.5 pr-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.map((s) => {
                  const percent = Math.round((s.completedHours / s.totalHours) * 100);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 pl-2 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {s.initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs group-hover:text-[#1a1642] transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{s.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-3 text-slate-600 font-medium">
                        {s.program}
                      </td>

                      <td className="py-4 px-3 text-slate-700 font-medium max-w-[180px] truncate">
                        {s.company}
                      </td>

                      <td className="py-4 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {s.period}
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-bold text-slate-700 text-xs">{s.completedHours}h</span>
                          <span className="text-[10px] text-slate-400">{s.totalHours}h</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {s.coordinator}
                      </td>

                      <td className="py-4 px-3 text-center">
                        <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-medium ${getStatusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>

                      <td className="py-4 pr-2 text-right">
                        <button className="text-slate-300 group-hover:text-slate-500 transition-colors cursor-pointer">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}