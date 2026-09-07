import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  FileText,
  Award,
  Bell,
  Building2,
  User,
  LogOut,
  X
} from 'lucide-react';

export default function CoordinatorSidebar({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
  onLogout
}) {
  const menuItems = [
    { id: 'coordinator-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'coordinator-students', label: 'Students', icon: Users },
    { id: 'coordinator-reports', label: 'Reports', icon: FileText },
    { id: 'coordinator-evaluations', label: 'Evaluations', icon: Award },
    { id: 'coordinator-announcements', label: 'Announcements', icon: Bell },
    { id: 'coordinator-companies', label: 'Companies', icon: Building2 },
  ];

  return (
    <>
      {/* Dark Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Slide-out Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl flex flex-col justify-between border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Section */}
        <div>
          {/* Header Branding */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1a1642] flex items-center justify-center text-[#f59e0b] shadow-md">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1a1642] leading-tight">OJT Monitor</h2>
                <span className="text-xs text-slate-400 font-medium">Coordinator Panel</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-[#1a1642]/10 text-[#1a1642] font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#1a1642]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive
                          ? 'text-[#1a1642]'
                          : 'text-slate-400 group-hover:text-[#1a1642]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {/* Active Indicator Dot */}
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Profile & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          {/* Profile Link */}
          <button
            onClick={() => {
              onNavigate('coordinator-profile');
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#1a1642] transition-colors"
          >
            <User className="w-5 h-5 text-slate-400" />
            <span>Profile</span>
          </button>

          {/* User Info Bar & Logout */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 px-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1a1642] text-[#f59e0b] font-bold text-xs flex items-center justify-center shadow">
                AR
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">Dr. Ana Reyes</p>
                <p className="text-[10px] text-slate-400">OJT Coordinator</p>
              </div>
            </div>

            {/* Logout Action */}
            <button
              onClick={onLogout}
              title="Log out"
              className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}