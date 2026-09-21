import React, { useState } from 'react';
import {
  Search,
  Plus,
  Building2,
  ChevronRight,
  Menu,
  Bell,
  ArrowLeft,
  Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const companiesData = [
  {
    id: 1,
    name: 'TechVision Solutions Inc.',
    since: 'Since 2024',
    industry: 'Information Technology',
    type: 'Internship',
    slots: 15,
    placed: 12,
    moaExpiry: 'Apr 1, 2027',
    expiryDays: '207d',
    expiryType: 'neutral',
    status: 'Active'
  },
  {
    id: 2,
    name: 'Globe Telecom PH',
    since: 'Since 2023',
    industry: 'Telecommunications',
    type: 'Internship',
    slots: 20,
    placed: 18,
    moaExpiry: 'Sep 20, 2026',
    expiryDays: '14d',
    expiryType: 'danger',
    status: 'Active'
  },
  {
    id: 3,
    name: 'BDO Unibank Inc.',
    since: 'Since 2024',
    industry: 'Banking & Finance',
    type: 'Internship',
    slots: 25,
    placed: 20,
    moaExpiry: 'Nov 10, 2026',
    expiryDays: '65d',
    expiryType: 'warning',
    status: 'Active'
  },
  {
    id: 4,
    name: 'Digital Innovations Corp.',
    since: 'Since 2025',
    industry: 'Software Development',
    type: 'Dual Training',
    slots: 10,
    placed: 0,
    moaExpiry: 'Jan 1, 2028',
    expiryDays: 'TBD',
    expiryType: 'neutral',
    status: 'Pending'
  },
  {
    id: 5,
    name: 'PhilCare Medical Group',
    since: 'Since 2025',
    industry: 'Healthcare',
    type: 'Training',
    slots: 8,
    placed: 0,
    moaExpiry: 'Jun 15, 2027',
    expiryDays: 'TBD',
    expiryType: 'neutral',
    status: 'Pending'
  },
  {
    id: 6,
    name: 'Ayala Land Inc.',
    since: 'Since 2023',
    industry: 'Real Estate',
    type: 'Internship',
    slots: 12,
    placed: 10,
    moaExpiry: 'Oct 15, 2026',
    expiryDays: '39d',
    expiryType: 'warning',
    status: 'Under Review'
  },
  {
    id: 7,
    name: 'Jollibee Foods Corp.',
    since: 'Since 2024',
    industry: 'Food & Beverage',
    type: 'Training',
    slots: 10,
    placed: 8,
    moaExpiry: 'Dec 31, 2026',
    expiryDays: '116d',
    expiryType: 'neutral',
    status: 'Under Review'
  }
];

export default function PartnerCompaniesPage({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filterTabs = ['All', 'Active', 'Pending', 'Under Review', 'Expired'];

  const stats = [
    { label: 'Total Partners', count: 8, filter: 'All', color: 'text-slate-800', border: 'border-emerald-500 ring-1 ring-emerald-500' },
    { label: 'Active MOA', count: 3, filter: 'Active', color: 'text-emerald-600', border: 'border-slate-200/80' },
    { label: 'Pending', count: 2, filter: 'Pending', color: 'text-amber-500', border: 'border-slate-200/80' },
    { label: 'Under Review', count: 2, filter: 'Under Review', color: 'text-purple-600', border: 'border-slate-200/80' }
  ];

  const filteredCompanies = companiesData.filter((item) => {
    const matchesFilter = activeFilter === 'All' || item.status === activeFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.industry.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active':
        return 'border border-emerald-300 text-emerald-600 bg-emerald-50';
      case 'Pending':
        return 'border border-amber-300 text-amber-600 bg-amber-50';
      case 'Under Review':
        return 'border border-purple-300 text-purple-600 bg-purple-50';
      default:
        return 'border border-gray-300 text-gray-600 bg-gray-50';
    }
  };

  const getExpiryBadge = (days, type) => {
    if (days === 'TBD') return <span className="text-gray-400 text-xs font-medium">TBD</span>;
    if (type === 'danger') {
      return (
        <span className="border border-red-200 bg-red-50 text-red-500 rounded-md px-2 py-0.5 text-xs font-semibold">
          {days}
        </span>
      );
    }
    if (type === 'warning') {
      return (
        <span className="border border-amber-200 bg-amber-50 text-amber-500 rounded-md px-2 py-0.5 text-xs font-semibold">
          {days}
        </span>
      );
    }
    return <span className="text-gray-400 text-xs">{days}</span>;
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-800 font-sans pb-12">
      {/* Top Header */}
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
                  Partner Companies
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <Briefcase className="w-3 h-3" /> CAREER PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-300">
                8 partner companies · 3 with active MOA
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
        {/* Title and Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Partner Companies</h2>
            <p className="text-xs text-slate-500 mt-0.5">8 partner companies · 3 with active MOA</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer">
            <Plus className="w-4 h-4" />
            Add Company
          </button>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              onClick={() => setActiveFilter(stat.filter)}
              className={`bg-white/95 backdrop-blur-md rounded-2xl p-5 border shadow-sm cursor-pointer hover:shadow-md transition-all ${
                activeFilter === stat.filter ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200/80'
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

        {/* Filter Tabs and Table Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search company..."
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

          {/* Companies Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                  <th className="pb-3.5 pl-2">Company</th>
                  <th className="pb-3.5 px-3">Industry</th>
                  <th className="pb-3.5 px-3 text-center">Type</th>
                  <th className="pb-3.5 px-3 text-center">Slots</th>
                  <th className="pb-3.5 px-3 text-center">Placed</th>
                  <th className="pb-3.5 px-3">MOA Expiry</th>
                  <th className="pb-3.5 px-3 text-center">Expiry</th>
                  <th className="pb-3.5 px-3 text-center">Status</th>
                  <th className="pb-3.5 pr-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-4 pl-2 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs group-hover:text-[#1a1642] transition-colors">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-slate-400">{c.since}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-3 text-slate-600 font-medium">
                      {c.industry}
                    </td>

                    <td className="py-4 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/60">
                        {c.type}
                      </span>
                    </td>

                    <td className="py-4 px-3 text-center text-slate-700 font-medium">
                      {c.slots}
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-[11px] text-slate-600 font-medium">
                          {c.placed}/{c.slots}
                        </span>
                        <div className="w-12 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${(c.placed / c.slots) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-3 text-slate-600 font-mono text-[11px]">
                      {c.moaExpiry}
                    </td>

                    <td className="py-4 px-3 text-center">
                      {getExpiryBadge(c.expiryDays, c.expiryType)}
                    </td>

                    <td className="py-4 px-3 text-center">
                      <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-medium ${getStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>

                    <td className="py-4 pr-2 text-right">
                      <button className="text-slate-300 hover:text-slate-500 transition-colors cursor-pointer">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}