import React from 'react';
import { 
  GraduationCap, 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Bell, 
  LogOut, 
  X 
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose, currentPage, onNavigate }) => {
  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'coordinators', label: 'Coordinators', icon: Users, hasDot: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <>
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-[#1A1D4E]/40 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 ease-in-out flex flex-col justify-between p-5 ${
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F5A800] text-[#1A1D4E] flex items-center justify-center font-bold shadow-sm">
                <GraduationCap size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1A1D4E] leading-tight">OJT Monitor</h2>
                <p className="text-xs text-slate-400">Dean / Chairman</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="mt-6 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = (currentPage === item.id) || (item.id === 'coordinators' && currentPage === 'coordinator-detail');

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition cursor-pointer ${
                    isActive 
                      ? 'bg-amber-50 text-[#F5A800] shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#1A1D4E]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-[#F5A800]' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {item.hasDot && (
                    <span className="w-2 h-2 rounded-full bg-[#F5A800]"></span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Bar */}
        <div className="space-y-4">
          <div className="bg-[#FFFBF0] border border-amber-200/70 rounded-2xl p-4 text-xs">
            <div className="font-bold text-[#1A1D4E]">Read-only access</div>
            <div className="text-[#F5A800] font-medium mt-0.5">Monitoring role only</div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F5A800] text-[#1A1D4E] flex items-center justify-center font-bold text-xs shadow-sm">
                JL
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1A1D4E] leading-tight">Dr. Junar A. Landicho</h4>
                <p className="text-xs text-slate-400">Dean / Chairman</p>
              </div>
            </div>
            <button className="text-slate-300 hover:text-slate-600 transition p-1.5 rounded-lg">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;