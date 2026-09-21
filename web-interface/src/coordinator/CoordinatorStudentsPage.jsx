import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Menu,
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const initialStudents = [
  {
    id: 1,
    initials: 'JD',
    name: 'John Dela Cruz',
    course: 'BS Computer Science',
    company: 'TechVision Solutions',
    hours: 240,
    totalHours: 500,
    barColor: 'bg-[#f59e0b]',
    status: 'active'
  },
  {
    id: 2,
    initials: 'MS',
    name: 'Maria Santos',
    course: 'BS Information Technology',
    company: 'Digital Innovations Corp',
    hours: 320,
    totalHours: 500,
    barColor: 'bg-blue-600',
    status: 'active'
  },
  {
    id: 3,
    initials: 'RC',
    name: 'Robert Chen',
    course: 'BS Computer Engineering',
    company: 'CloudNine Technologies',
    hours: 180,
    totalHours: 500,
    barColor: 'bg-[#f59e0b]',
    status: 'active'
  },
  {
    id: 4,
    initials: 'LG',
    name: 'Lisa Garcia',
    course: 'BS Computer Science',
    company: 'TechVision Solutions',
    hours: 0,
    totalHours: 500,
    barColor: '',
    status: 'pending'
  },
  {
    id: 5,
    initials: 'MT',
    name: 'Michael Tan',
    course: 'BS Information Systems',
    company: 'Digital Innovations Corp',
    hours: 450,
    totalHours: 500,
    barColor: 'bg-emerald-500',
    status: 'active'
  },
  {
    id: 6,
    initials: 'AC',
    name: 'Angela Cruz',
    course: 'BS Computer Science',
    company: 'DataSolutions Inc.',
    hours: 280,
    totalHours: 500,
    barColor: 'bg-blue-600',
    status: 'active'
  }
];

export default function CoordinatorStudentsPage({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const stats = [
    {
      title: 'Total Students',
      value: 6,
      icon: Users,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
      filter: 'All'
    },
    {
      title: 'Active Interns',
      value: 5,
      icon: UserCheck,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      filter: 'Active'
    },
    {
      title: 'Pending',
      value: 1,
      icon: Clock,
      iconBg: 'bg-[#f59e0b]/15',
      iconColor: 'text-[#f59e0b]',
      filter: 'Pending'
    }
  ];

  const filteredStudents = initialStudents.filter((student) => {
    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Active' && student.status === 'active') ||
      (activeFilter === 'Pending' && student.status === 'pending');

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      student.name.toLowerCase().includes(searchLower) ||
      student.course.toLowerCase().includes(searchLower) ||
      student.company.toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      {/* Header */}
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
                  Student Management
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <GraduationCap className="w-3 h-3" /> COORDINATOR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                6 students enrolled this term
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
        
        {/* Title Header with high-contrast text against background */}
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
            Student Management
          </h2>
          <p className="text-xs text-slate-200 mt-0.5 drop-shadow-xs">
            6 students enrolled this term
          </p>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            const isSelected = activeFilter === stat.filter;
            return (
              <div
                key={idx}
                onClick={() => setActiveFilter(stat.filter)}
                className={`bg-white/95 backdrop-blur-md rounded-2xl p-5 border shadow-xs cursor-pointer hover:shadow-md transition-all ${
                  isSelected
                    ? 'border-[#1a1642] ring-2 ring-[#1a1642]/20'
                    : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {stat.title}
                  </span>
                  <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                    <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                </div>
                <span className="text-3xl font-extrabold text-slate-800">
                  {stat.value}
                </span>
              </div>
            );
          })}
        </div>

        {/* Table Container Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          
          {/* Search Bar & Filter Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, course, or company..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1a1642] focus:ring-1 focus:ring-[#1a1642] transition-all bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              {['All', 'Active', 'Pending'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeFilter === filter
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}

              <button
                title="Filters"
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                  <th className="pb-3.5 pl-2">Student</th>
                  <th className="pb-3.5 px-3">Course</th>
                  <th className="pb-3.5 px-3">Company</th>
                  <th className="pb-3.5 px-3 min-w-[200px]">Progress</th>
                  <th className="pb-3.5 px-3 text-center">Status</th>
                  <th className="pb-3.5 pr-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.map((s) => {
                  const percent = Math.round((s.hours / s.totalHours) * 100);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 pl-2 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {s.initials}
                          </div>
                          <span className="font-semibold text-slate-800 text-xs group-hover:text-[#1a1642] transition-colors">
                            {s.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-3 text-slate-600 font-medium">
                        {s.course}
                      </td>

                      <td className="py-4 px-3 text-slate-700 font-medium">
                        {s.company}
                      </td>

                      <td className="py-4 px-3">
                        {s.status === 'pending' ? (
                          <span className="text-xs text-slate-400 font-medium">Not started</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-28 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${s.barColor}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                              {s.hours}/{s.totalHours} hrs
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-3 text-center">
                        <span
                          className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                            s.status === 'active'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}
                        >
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