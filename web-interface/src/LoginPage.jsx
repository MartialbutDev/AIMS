import React, { useState } from 'react';
import { 
  GraduationCap, 
  UserCheck, 
  Briefcase, 
  Building, 
  ShieldCheck, 
  Lock, 
  User, 
  ArrowRight,
  ChevronLeft
} from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 5 Portal Roles
  const roles = [
    {
      id: 'dean',
      title: 'Dean / Chairman',
      desc: 'Department overview & overall monitor',
      icon: GraduationCap,
      color: 'from-blue-600 to-indigo-800'
    },
    {
      id: 'coordinator',
      title: 'OJT Coordinator',
      desc: 'Section management & report review',
      icon: UserCheck,
      color: 'from-amber-500 to-orange-600'
    },
    {
      id: 'career_center',
      title: 'Career Center',
      desc: 'Industry matching & placement hub',
      icon: Briefcase,
      color: 'from-emerald-500 to-teal-700'
    },
    {
      id: 'company',
      title: 'Host Company / HTE',
      desc: 'Student evaluation & attendance',
      icon: Building,
      color: 'from-purple-600 to-violet-800'
    },
    {
      id: 'admin',
      title: 'System Admin',
      desc: 'User permissions, system config & logs',
      icon: ShieldCheck,
      color: 'from-slate-700 to-slate-900'
    }
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setError('');
    // Pass user info and selected role to parent component
    onLoginSuccess({
      role: selectedRole.id,
      username: username
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 selection:bg-[#f59e0b] selection:text-white">
      {/* Background Banner Decoration */}
      <div className="w-full max-w-4xl bg-[#1a1642] rounded-3xl shadow-2xl border-b-4 border-[#f59e0b] overflow-hidden">
        
        {/* Header Branding */}
        <div className="p-8 text-center border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl mb-3">
            <GraduationCap className="w-10 h-10 text-[#f59e0b]" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-wider">AIMS PORTAL</h1>
          <p className="text-xs uppercase tracking-widest text-[#f59e0b] font-semibold mt-1">
            Automated OJT Internship & Management System
          </p>
        </div>

        <div className="p-6 md:p-10 bg-slate-50">
          {!selectedRole ? (
            /* STAGE 1: ROLE SELECTION */
            <div>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-[#1a1642]">Select Your Role</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Choose your department portal to continue to login
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      onClick={() => {
                        setSelectedRole(role);
                        setError('');
                      }}
                      className="group p-5 bg-white border border-slate-200 hover:border-[#f59e0b] rounded-2xl text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-[#1a1642]/5 group-hover:bg-[#f59e0b]/10 flex items-center justify-center mb-4 transition-colors">
                          <Icon className="w-6 h-6 text-[#1a1642] group-hover:text-[#f59e0b] transition-colors" />
                        </div>
                        <h3 className="font-bold text-slate-800 group-hover:text-[#1a1642] text-base">
                          {role.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {role.desc}
                        </p>
                      </div>
                      
                      <div className="mt-4 flex items-center text-xs font-semibold text-[#1a1642] group-hover:text-[#f59e0b] gap-1">
                        Enter Portal <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STAGE 2: CREDENTIALS INPUT */
            <div className="max-w-md mx-auto">
              <button
                onClick={() => setSelectedRole(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#1a1642] mb-6 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Change Role Selection
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1a1642]/10 text-[#1a1642] mb-2">
                  <selectedRole.icon className="w-6 h-6 text-[#1a1642]" />
                </div>
                <h2 className="text-xl font-bold text-[#1a1642]">
                  {selectedRole.title} Login
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your assigned credentials to sign in
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs text-center font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Username / ID
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder="e.g. user@ustp.edu.ph"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#1a1642] focus:ring-1 focus:ring-[#1a1642]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#1a1642] focus:ring-1 focus:ring-[#1a1642]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-[#1a1642] hover:bg-[#251f5c] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border-b-2 border-[#f59e0b]"
                >
                  Sign In to Dashboard <ArrowRight className="w-4 h-4 text-[#f59e0b]" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}