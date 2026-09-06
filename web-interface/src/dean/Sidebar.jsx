import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BarChart3,
  Bell,
  X,
  LogOut
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
  onLogout
}) {
  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'coordinators', label: 'Coordinators', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
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

      {/* Slide-out Sidebar Drawer */}
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
              <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-md">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1a1642] leading-tight">OJT Monitor</h2>
                <span className="text-xs text-slate-400 font-medium">Dean / Chairman</span>
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
                      ? 'bg-amber-50 text-amber-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#1a1642]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive
                          ? 'text-amber-600'
                          : 'text-slate-400 group-hover:text-[#1a1642]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          {/* Read-Only Status Badge */}
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3">
            <span className="text-[11px] font-bold text-[#1a1642] block">Read-only access</span>
            <span className="text-[10px] text-amber-700 font-medium">Monitoring role only</span>
          </div>

          {/* User Profile & Working Logout Button */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 px-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow">
                JL
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">Dr. Junar A. Landicho</p>
                <p className="text-[10px] text-slate-400">Dean / Chairman</p>
              </div>
            </div>

            {/* Logout Action */}
            <button
              onClick={() => {
                onClose();
                if (onLogout) onLogout();
              }}
              title="Log out"
              className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}