import React, { useState } from 'react';
import {
  Search,
  ChevronRight,
  Menu,
  GraduationCap,
  Star,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const initialEvaluations = [
  {
    id: 1,
    initials: 'JD',
    name: 'John Dela Cruz',
    course: 'BSCS',
    company: 'TechVision Solutions',
    midtermStatus: 'Submitted',
    midtermScore: 4.3,
    finalStatus: 'Not Started',
    finalScore: null,
    actionType: 'Final',
    isFullyComplete: false
  },
  {
    id: 2,
    initials: 'MS',
    name: 'Maria Santos',
    course: 'BSIT',
    company: 'DataSolutions Inc.',
    midtermStatus: 'Submitted',
    midtermScore: 4.7,
    finalStatus: 'Draft',
    finalScore: null,
    actionType: 'Continue',
    isFullyComplete: false
  },
  {
    id: 3,
    initials: 'RC',
    name: 'Robert Chen',
    course: 'BSCS',
    company: 'InnovateIT',
    midtermStatus: 'Not Started',
    midtermScore: null,
    finalStatus: 'Not Started',
    finalScore: null,
    actionType: 'Midterm',
    isFullyComplete: false
  },
  {
    id: 4,
    initials: 'CM',
    name: 'Carlo Mendoza',
    course: 'BSCS',
    company: 'TechCorp PH',
    midtermStatus: 'Draft',
    midtermScore: null,
    finalStatus: 'Not Started',
    finalScore: null,
    actionType: 'Continue',
    isFullyComplete: false
  },
  {
    id: 5,
    initials: 'AC',
    name: 'Angela Cruz',
    course: 'BSIT',
    company: 'DataSolutions Inc.',
    midtermStatus: 'Submitted',
    midtermScore: 4.1,
    finalStatus: 'Not Started',
    finalScore: null,
    actionType: 'Final',
    isFullyComplete: false
  },
  {
    id: 6,
    initials: 'LG',
    name: 'Lisa Garcia',
    course: 'BSIT',
    company: 'Globe Telecom',
    midtermStatus: 'Submitted',
    midtermScore: 4.8,
    finalStatus: 'Submitted',
    finalScore: 4.9,
    actionType: null,
    isFullyComplete: true
  }
];

export default function CoordinatorEvaluationsPage({ onOpenSidebar, onSelectStudent }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Pending');
  const [searchTerm, setSearchTerm] = useState('');

  const totalCount = initialEvaluations.length;
  const fullyCompleteCount = initialEvaluations.filter((item) => item.isFullyComplete).length;
  const pendingCount = totalCount - fullyCompleteCount;

  const filteredEvaluations = initialEvaluations.filter((item) => {
    const matchesTab =
      activeTab === 'All' ||
      (activeTab === 'Pending' && !item.isFullyComplete) ||
      (activeTab === 'Completed' && item.isFullyComplete);

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(term) ||
      item.company.toLowerCase().includes(term) ||
      item.course.toLowerCase().includes(term);

    return matchesTab && matchesSearch;
  });

  const renderBadge = (status) => {
    switch (status) {
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Submitted
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
            <Clock className="w-3 h-3" /> Draft
          </span>
        );
      case 'Not Started':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
            <AlertCircle className="w-3 h-3 text-slate-400" /> Not Started
          </span>
        );
    }
  };

  const handleActionClick = (student) => {
    if (onSelectStudent) {
      onSelectStudent(student);
    } else {
      navigate('/coordinator/student-detail', { state: { student } });
    }
  };

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
                  Student Evaluations
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                  <GraduationCap className="w-3 h-3" /> COORDINATOR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {pendingCount} pending · {fullyCompleteCount} completed
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
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
            Student Evaluations
          </h2>
          <p className="text-xs text-slate-200 mt-0.5 drop-shadow-xs">
            {pendingCount} pending · {fullyCompleteCount} completed
          </p>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setActiveTab('All')}
            className={`bg-white/95 backdrop-blur-md rounded-2xl p-5 border shadow-xs cursor-pointer hover:shadow-md transition-all ${
              activeTab === 'All' ? 'border-[#1a1642] ring-2 ring-[#1a1642]/20' : 'border-slate-200/80'
            }`}
          >
            <span className="text-3xl font-extrabold text-slate-800 block leading-none mb-1">
              {totalCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">Total Students</span>
          </div>

          <div
            onClick={() => setActiveTab('Pending')}
            className={`bg-[#fffdf5]/95 backdrop-blur-md rounded-2xl p-5 border shadow-xs cursor-pointer hover:shadow-md transition-all ${
              activeTab === 'Pending' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-amber-200/60'
            }`}
          >
            <span className="text-3xl font-extrabold text-amber-600 block leading-none mb-1">
              {pendingCount}
            </span>
            <span className="text-xs font-semibold text-slate-600">Pending Evaluation</span>
          </div>

          <div
            onClick={() => setActiveTab('Completed')}
            className={`bg-[#f6fcf8]/95 backdrop-blur-md rounded-2xl p-5 border shadow-xs cursor-pointer hover:shadow-md transition-all ${
              activeTab === 'Completed' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-200/60'
            }`}
          >
            <span className="text-3xl font-extrabold text-emerald-600 block leading-none mb-1">
              {fullyCompleteCount}
            </span>
            <span className="text-xs font-semibold text-slate-600">Fully Complete</span>
          </div>
        </div>

        {/* Tab Buttons & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            {['All', 'Pending', 'Completed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white/90 text-slate-600 hover:bg-white border border-slate-200/80'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student or company..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#1a1642] focus:ring-1 focus:ring-[#1a1642] transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Evaluations Table Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                  <th className="pb-3.5 pl-2">Student</th>
                  <th className="pb-3.5 px-3">Company</th>
                  <th className="pb-3.5 px-3">Midterm</th>
                  <th className="pb-3.5 px-3">Score</th>
                  <th className="pb-3.5 px-3">Final</th>
                  <th className="pb-3.5 px-3">Score</th>
                  <th className="pb-3.5 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEvaluations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Student Column */}
                    <td className="py-4 pl-2 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                          {item.initials}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 text-xs block group-hover:text-blue-600 transition-colors">
                            {item.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {item.course}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Company Column */}
                    <td className="py-4 px-3 text-slate-700 font-medium">
                      {item.company}
                    </td>

                    {/* Midterm Status */}
                    <td className="py-4 px-3">
                      {renderBadge(item.midtermStatus)}
                    </td>

                    {/* Midterm Score */}
                    <td className="py-4 px-3">
                      {item.midtermScore ? (
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{item.midtermScore}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-medium">—</span>
                      )}
                    </td>

                    {/* Final Status */}
                    <td className="py-4 px-3">
                      {renderBadge(item.finalStatus)}
                    </td>

                    {/* Final Score */}
                    <td className="py-4 px-3">
                      {item.finalScore ? (
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{item.finalScore}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-medium">—</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-4 pr-2 text-right">
                      {item.actionType ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleActionClick(item)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <span>{item.actionType}</span>
                          </button>
                          <button
                            onClick={() => handleActionClick(item)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleActionClick(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer inline-flex items-center"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
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