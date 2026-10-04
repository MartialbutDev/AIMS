import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Users,
  Search,
  CheckCircle2,
  Menu,
  GraduationCap,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const companiesData = [
  {
    id: 1,
    name: 'TechVision Solutions',
    industry: 'Software Development',
    location: 'Makati City, Metro Manila',
    employees: '500-1000 employees',
    openSlots: 5,
    filledSlots: 5,
    totalSlots: 10,
    currentStudents: [
      { id: 'JD', name: 'John Dela Cruz', program: 'BS Computer Science' },
      { id: 'LG', name: 'Lisa Garcia', program: 'BS Computer Science' }
    ]
  },
  {
    id: 2,
    name: 'Digital Innovations Corp',
    industry: 'IT Consulting',
    location: 'BGC, Taguig',
    employees: '200-500 employees',
    openSlots: 6,
    filledSlots: 2,
    totalSlots: 8,
    currentStudents: [
      { id: 'MS', name: 'Maria Santos', program: 'BS Information Technology' },
      { id: 'MT', name: 'Michael Tan', program: 'BS Information Systems' }
    ]
  },
  {
    id: 3,
    name: 'CloudNine Technologies',
    industry: 'Cloud Services',
    location: 'Ortigas, Pasig',
    employees: '100-250 employees',
    openSlots: 4,
    filledSlots: 1,
    totalSlots: 5,
    currentStudents: [
      { id: 'RC', name: 'Robert Chen', program: 'BS Computer Engineering' }
    ]
  }
];

export default function CoordinatorCompaniesPage({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(1);

  const totalSlotsCount = companiesData.reduce((acc, c) => acc + c.totalSlots, 0);

  const filteredCompanies = companiesData.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCompany =
    companiesData.find((c) => c.id === selectedCompanyId) || companiesData[0];

  const fillPercentage = Math.round(
    (selectedCompany.filledSlots / selectedCompany.totalSlots) * 100
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      {/* Top Header Bar */}
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
                  Company Assignment
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <GraduationCap className="w-3 h-3" /> COORDINATOR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {companiesData.length} partner companies · {totalSlotsCount} total slots
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
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
              Company Assignment
            </h2>
            <p className="text-xs text-slate-200 mt-0.5 drop-shadow-xs">
              {companiesData.length} partner companies · {totalSlotsCount} total slots
            </p>
          </div>

          <button
            onClick={() => navigate('/coordinator/students')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Assign Student
          </button>
        </div>

        {/* 2-Column Split: Company List & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Available Companies List */}
          <div className="lg:col-span-4 space-y-3">
            {/* Search Input */}
            <div className="relative bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#1a1642]"
              />
            </div>

            {/* Company Cards */}
            <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
              {filteredCompanies.map((c) => {
                const isSelected = selectedCompany.id === c.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCompanyId(c.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-[#f59e0b] ring-2 ring-[#f59e0b]/20 shadow-md'
                        : 'bg-white/95 backdrop-blur-md border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-[#f59e0b] flex-shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate">
                          {c.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{c.industry}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{c.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Slots Stats */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                      <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-2 text-center">
                        <span className="text-xs font-black text-emerald-600 block">
                          {c.openSlots}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
                          open
                        </span>
                      </div>

                      <div className="bg-blue-50/60 border border-blue-100/80 rounded-xl p-2 text-center">
                        <span className="text-xs font-black text-blue-600 block">
                          {c.filledSlots}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
                          filled
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Company Details & Current Interns */}
          <div className="lg:col-span-8 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            {/* Header info */}
            <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-[#f59e0b] flex-shrink-0">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {selectedCompany.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedCompany.industry}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedCompany.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {selectedCompany.employees}
                  </span>
                </div>
              </div>
            </div>

            {/* Slot Utilization Bar */}
            <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Slot Utilization</span>
                <span className="font-semibold text-slate-500">
                  {selectedCompany.filledSlots}/{selectedCompany.totalSlots} filled
                </span>
              </div>
              <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#f59e0b] h-full rounded-full transition-all duration-500"
                  style={{ width: `${fillPercentage}%` }}
                />
              </div>
            </div>

            {/* Current Students Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                Current Students ({selectedCompany.currentStudents.length})
              </h4>

              <div className="space-y-2.5">
                {selectedCompany.currentStudents.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        {st.id}
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-slate-800 block">
                          {st.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {st.program}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">Active</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}