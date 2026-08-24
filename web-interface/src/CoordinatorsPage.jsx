import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, ChevronRight, ArrowLeft, Menu } from 'lucide-react';

const CoordinatorsPage = ({ onBack, onSelectCoordinator, onOpenSidebar }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const coordinatorsData = [
    {
      id: 1,
      initials: 'KA',
      name: 'Ken Ampolitod',
      email: 'k.ampolitod@ustp.edu.ph',
      section: 'BSIT 4A & 4B',
      students: 48,
      active: 42,
      pending: 3,
      completion: 87,
      companies: ['TechCorp PH', 'DataSolutions Inc.'],
      extraCompanies: '+2',
      allCompanies: ['TechCorp PH', 'DataSolutions Inc.', 'InnovateIT', 'Globe Telecom'],
      trend: 'up',
      avatarBg: 'bg-[#1A1D4E]',
      barColor: 'bg-[#F5A800]',
      assignedStudents: [
        { id: 1, initials: 'JD', name: 'John Dela Cruz', company: 'TechCorp PH', hours: 360, totalHours: 480, percentage: 75, status: 'Active', barColor: 'bg-[#F5A800]' },
        { id: 2, initials: 'MS', name: 'Maria Santos', company: 'DataSolutions Inc.', hours: 400, totalHours: 480, percentage: 83, status: 'Active', barColor: 'bg-[#1A1D4E]' },
        { id: 3, initials: 'RC', name: 'Robert Chen', company: 'InnovateIT', hours: 200, totalHours: 480, percentage: 42, status: 'Active', barColor: 'bg-red-400' },
        { id: 4, initials: 'LG', name: 'Lisa Garcia', company: 'Globe Telecom', hours: 450, totalHours: 480, percentage: 94, status: 'Active', barColor: 'bg-[#1A1D4E]' },
        { id: 5, initials: 'CM', name: 'Carlo Mendoza', company: 'TechCorp PH', hours: 0, totalHours: 480, percentage: 0, status: 'Pending', barColor: 'bg-slate-200' },
        { id: 6, initials: 'AC', name: 'Angela Cruz', company: 'DataSolutions Inc.', hours: 320, totalHours: 480, percentage: 67, status: 'Active', barColor: 'bg-[#F5A800]' },
      ],
    },
    {
      id: 2,
      initials: 'FI',
      name: 'Faisal Inidal',
      email: 'f.inidal@ustp.edu.ph',
      section: 'BSCS 4A & 4B',
      students: 36,
      active: 33,
      pending: 1,
      completion: 92,
      companies: ['Accenture PH', 'IBM Philippines'],
      extraCompanies: '+1',
      allCompanies: ['Accenture PH', 'IBM Philippines', 'Google Cloud Partner'],
      trend: 'up',
      avatarBg: 'bg-[#2D3270]',
      barColor: 'bg-[#1A1D4E]',
      assignedStudents: [
        { id: 1, initials: 'EV', name: 'Ethan Valenzuela', company: 'Accenture PH', hours: 460, totalHours: 480, percentage: 96, status: 'Active', barColor: 'bg-[#1A1D4E]' },
        { id: 2, initials: 'SN', name: 'Sophia Navarro', company: 'IBM Philippines', hours: 430, totalHours: 480, percentage: 90, status: 'Active', barColor: 'bg-[#1A1D4E]' },
        { id: 3, initials: 'KL', name: 'Kevin Lee', company: 'Google Cloud Partner', hours: 440, totalHours: 480, percentage: 92, status: 'Active', barColor: 'bg-[#F5A800]' },
        { id: 4, initials: 'PP', name: 'Patricia Perez', company: 'Accenture PH', hours: 0, totalHours: 480, percentage: 0, status: 'Pending', barColor: 'bg-slate-200' },
      ],
    },
    {
      id: 3,
      initials: 'ML',
      name: 'Maikent Lopez',
      email: 'm.lopez@ustp.edu.ph',
      section: 'BSIS 4A',
      students: 24,
      active: 20,
      pending: 5,
      completion: 78,
      companies: ['UnionBank', 'BDO Unibank'],
      extraCompanies: '+1',
      allCompanies: ['UnionBank', 'BDO Unibank', 'Maya Philippines'],
      trend: 'down',
      avatarBg: 'bg-[#F5A800]',
      barColor: 'bg-[#F5A800]',
      assignedStudents: [
        { id: 1, initials: 'DB', name: 'Daniel Bautista', company: 'UnionBank', hours: 375, totalHours: 480, percentage: 78, status: 'Active', barColor: 'bg-[#F5A800]' },
        { id: 2, initials: 'JA', name: 'Joyce Aquino', company: 'BDO Unibank', hours: 250, totalHours: 480, percentage: 52, status: 'Active', barColor: 'bg-[#1A1D4E]' },
        { id: 3, initials: 'MT', name: 'Mark Tolentino', company: 'Maya Philippines', hours: 0, totalHours: 480, percentage: 0, status: 'Pending', barColor: 'bg-slate-200' },
      ],
    },
    {
      id: 4,
      initials: 'VN',
      name: 'Varren Naive',
      email: 'v.naive@ustp.edu.ph',
      section: 'BSCE 4A',
      students: 20,
      active: 19,
      pending: 0,
      completion: 95,
      companies: ['Megaworld Corp', 'DMCI Holdings'],
      extraCompanies: null,
      allCompanies: ['Megaworld Corp', 'DMCI Holdings', 'EEI Corporation'],
      trend: 'neutral',
      avatarBg: 'bg-[#1A1D4E]',
      barColor: 'bg-[#1A1D4E]',
      assignedStudents: [
        { id: 1, initials: 'GT', name: 'Gabriel Torres', company: 'Megaworld Corp', hours: 470, totalHours: 480, percentage: 98, status: 'Active', barColor: 'bg-[#1A1D4E]' },
        { id: 2, initials: 'HL', name: 'Hannah Lopez', company: 'DMCI Holdings', hours: 455, totalHours: 480, percentage: 95, status: 'Active', barColor: 'bg-[#F5A800]' },
        { id: 3, initials: 'RP', name: 'Rafael Pascual', company: 'EEI Corporation', hours: 440, totalHours: 480, percentage: 92, status: 'Active', barColor: 'bg-[#1A1D4E]' },
      ],
    },
  ];

  const filteredCoordinators = coordinatorsData.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F4F5F9] p-6 lg:p-10 font-sans text-slate-800">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenSidebar}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-[#1A1D4E] hover:bg-slate-50 transition shadow-sm cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1D4E]">Coordinators</h1>
            <p className="text-xs text-slate-500 mt-0.5">4 active coordinators · 128 total students</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-[#1A1D4E] hover:bg-slate-50 hover:text-[#F5A800] transition shadow-sm cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {coordinatorsData.map((coord) => (
          <div 
            key={coord.id} 
            onClick={() => onSelectCoordinator(coord)}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-[#F5A800] hover:shadow-md transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full ${coord.avatarBg} text-white flex items-center justify-center font-bold text-xs`}>
                {coord.initials}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1A1D4E] leading-tight hover:text-[#F5A800]">{coord.name}</div>
                <div className="text-xs text-slate-400">{coord.section}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full ${coord.barColor}`} style={{ width: `${coord.completion}%` }}></div>
              </div>
              <span className="text-xs font-semibold text-slate-600">{coord.completion}%</span>
            </div>
            <div className="text-xs text-slate-400 mt-3">
              {coord.students} students · {coord.active} active
            </div>
          </div>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search coordinator or section..."
          className="w-full max-w-md pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5A800]/40 focus:border-[#F5A800] transition shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
              <th className="px-6 py-4">COORDINATOR</th>
              <th className="px-6 py-4">SECTION</th>
              <th className="px-6 py-4 text-center">STUDENTS</th>
              <th className="px-6 py-4 text-center">ACTIVE</th>
              <th className="px-6 py-4 text-center">PENDING</th>
              <th className="px-6 py-4">COMPLETION</th>
              <th className="px-6 py-4">COMPANIES</th>
              <th className="px-6 py-4 text-center">TREND</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
            {filteredCoordinators.map((c) => (
              <tr 
                key={c.id} 
                onClick={() => onSelectCoordinator(c)}
                className="hover:bg-slate-50/80 transition cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${c.avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0`}>
                      {c.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-[#1A1D4E] text-sm hover:text-[#F5A800] transition">{c.name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{c.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500">{c.section}</td>
                <td className="px-6 py-4 text-center font-bold text-[#1A1D4E]">{c.students}</td>
                <td className="px-6 py-4 text-center font-bold text-[#F5A800]">{c.active}</td>
                <td className="px-6 py-4 text-center font-bold text-amber-600">{c.pending}</td>
                <td className="px-6 py-4 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-1.5 rounded-full ${c.barColor}`} style={{ width: `${c.completion}%` }}></div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600">{c.completion}%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.companies.map((company, idx) => (
                      <span key={idx} className="bg-amber-50 text-[#1A1D4E] text-[11px] font-medium px-2.5 py-1 rounded-md border border-amber-200">
                        {company}
                      </span>
                    ))}
                    {c.extraCompanies && (
                      <span className="bg-slate-100 text-slate-500 text-[11px] px-2 py-1 rounded-md border border-slate-200">
                        {c.extraCompanies}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    {c.trend === 'up' && <TrendingUp size={16} className="text-emerald-500" />}
                    {c.trend === 'down' && <TrendingDown size={16} className="text-red-400" />}
                    {c.trend === 'neutral' && <Minus size={16} className="text-slate-300" />}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <ChevronRight size={16} className="text-slate-300 inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CoordinatorsPage;