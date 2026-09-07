import React, { useState } from 'react';
import { ArrowLeft, Mail, Building2, CheckCircle, Clock } from 'lucide-react';

const CoordinatorDetailPage = ({ coordinator, onBack }) => {
  const [filter, setFilter] = useState('All');

  const students = coordinator.assignedStudents || [];

  const filteredStudents = students.filter((s) => {
    if (filter === 'All') return true;
    return s.status.toLowerCase() === filter.toLowerCase();
  });

  const countActive = students.filter((s) => s.status === 'Active').length;
  const countPending = students.filter((s) => s.status === 'Pending').length;
  const countInactive = students.filter((s) => s.status === 'Inactive').length;

  return (
    <div className="min-h-screen bg-[#F4F5F9] p-6 lg:p-10 font-sans text-slate-800">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-[#1A1D4E] hover:text-[#F5A800] transition"
        >
          <ArrowLeft size={16} /> Back to Coordinators
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className={`w-8 h-8 rounded-xl ${coordinator.avatarBg} text-white flex items-center justify-center font-bold text-xs`}>
            {coordinator.initials}
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#1A1D4E] leading-tight">{coordinator.name}</h1>
            <p className="text-[11px] text-slate-400">{coordinator.section} · {coordinator.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column Profile & Stats */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-2xl ${coordinator.avatarBg} text-white flex items-center justify-center font-bold text-2xl mb-4 shadow-sm border-2 border-[#F5A800]`}>
              {coordinator.initials}
            </div>
            <h2 className="text-base font-bold text-[#1A1D4E]">{coordinator.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{coordinator.section}</p>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl w-full justify-center">
              <Mail size={14} className="text-slate-400" />
              <span className="truncate">{coordinator.email}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Stats</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Total Students</span>
                <span className="font-bold text-[#1A1D4E] text-sm">{coordinator.students}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Active</span>
                <span className="font-bold text-[#F5A800] text-sm">{coordinator.active}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Pending Docs</span>
                <span className="font-bold text-amber-600 text-sm">{coordinator.pending}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Companies</span>
                <span className="font-bold text-[#1A1D4E] text-sm">{coordinator.allCompanies.length}</span>
              </div>
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-slate-500">Completion</span>
                  <span className="font-bold text-[#1A1D4E]">{coordinator.completion}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full ${coordinator.barColor}`} style={{ width: `${coordinator.completion}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1A1D4E] mb-4">
              <Building2 size={16} className="text-[#F5A800]" />
              <span>Companies</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {coordinator.allCompanies.map((c, i) => (
                <span key={i} className="bg-amber-50/80 text-[#1A1D4E] text-xs px-3 py-1.5 rounded-lg border border-amber-200">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Assigned Students */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Assigned Students
            </h2>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 bg-slate-200/60 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setFilter('All')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${filter === 'All' ? 'bg-[#1A1D4E] text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${filter === 'All' ? 'bg-[#F5A800] text-[#1A1D4E] font-bold' : 'bg-slate-300/60 text-slate-600'}`}>{students.length}</span>
              </button>
              <button
                onClick={() => setFilter('Active')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${filter === 'Active' ? 'bg-[#1A1D4E] text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Active <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${filter === 'Active' ? 'bg-[#F5A800] text-[#1A1D4E] font-bold' : 'bg-slate-300/60 text-slate-600'}`}>{countActive}</span>
              </button>
              <button
                onClick={() => setFilter('Pending')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${filter === 'Pending' ? 'bg-[#1A1D4E] text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Pending <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${filter === 'Pending' ? 'bg-[#F5A800] text-[#1A1D4E] font-bold' : 'bg-slate-300/60 text-slate-600'}`}>{countPending}</span>
              </button>
              <button
                onClick={() => setFilter('Inactive')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${filter === 'Inactive' ? 'bg-[#1A1D4E] text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Inactive <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${filter === 'Inactive' ? 'bg-[#F5A800] text-[#1A1D4E] font-bold' : 'bg-slate-300/60 text-slate-600'}`}>{countInactive}</span>
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-4">STUDENT</th>
                  <th className="px-6 py-4">COMPANY</th>
                  <th className="px-6 py-4">OJT HOURS</th>
                  <th className="px-6 py-4 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-[#1A1D4E] flex items-center justify-center font-bold text-xs shrink-0">
                          {s.initials}
                        </div>
                        <span className="font-semibold text-slate-800 text-sm">{s.name}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {s.company}
                    </td>

                    <td className="px-6 py-4 min-w-[200px]">
                      {s.status === 'Pending' ? (
                        <span className="bg-amber-50 text-amber-700 text-[11px] px-3 py-1 rounded-full font-medium border border-amber-200">
                          Awaiting approval
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-1.5 rounded-full ${s.barColor}`} style={{ width: `${s.percentage}%` }}></div>
                          </div>
                          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                            {s.hours}/{s.totalHours}h · {s.percentage}%
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      {s.status === 'Active' && (
                        <span className="inline-flex items-center gap-1 text-[#1A1D4E] font-semibold bg-amber-100/70 px-2.5 py-1 rounded-full text-[11px]">
                          <CheckCircle size={12} className="text-[#F5A800]" /> Active
                        </span>
                      )}
                      {s.status === 'Pending' && (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full text-[11px]">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                      {s.status === 'Inactive' && (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-full text-[11px]">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDetailPage;
