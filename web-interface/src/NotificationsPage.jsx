import React, { useState } from 'react';
import { 
  AlertCircle, 
  Star, 
  Bell, 
  Info, 
  Check, 
  Menu, 
  ArrowLeft 
} from 'lucide-react';

const NotificationsPage = ({ onBack, onOpenSidebar }) => {
  const [filter, setFilter] = useState('All');
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'Alerts',
      title: 'Coordinator Report Due',
      description: 'Prof. Mark Lim has 3 student evaluations overdue by more than 7 days.',
      time: '10 mins ago',
      isUnread: true,
      hasBorder: true,
      icon: AlertCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50',
    },
    {
      id: 2,
      type: 'Updates',
      title: 'New Company Partnership',
      description: 'Dr. Ana Reyes submitted a new MOA with TechCorp Philippines. Pending your review.',
      time: '1 hour ago',
      isUnread: true,
      hasBorder: true,
      icon: Star,
      iconColor: 'text-[#F5A800]',
      iconBg: 'bg-amber-50',
    },
    {
      id: 3,
      type: 'Updates',
      title: 'Mid-term Evaluations Complete',
      description: 'Ms. Carla Vega completed all mid-term evaluations for BSIS 4A (24 students).',
      time: '3 hours ago',
      isUnread: true,
      hasBorder: true,
      icon: Bell,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
    },
    {
      id: 4,
      type: 'Alerts',
      title: 'Low Completion Rate Alert',
      description: 'BSIS 4A section has dropped below 80% completion rate this week.',
      time: 'Yesterday',
      isUnread: false,
      hasBorder: false,
      icon: AlertCircle,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
    },
    {
      id: 5,
      type: 'System',
      title: 'System Maintenance',
      description: 'The OJT portal will undergo scheduled maintenance on Saturday, 11 PM – 2 AM.',
      time: '2 days ago',
      isUnread: false,
      hasBorder: false,
      icon: Info,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
    },
    {
      id: 6,
      type: 'Updates',
      title: 'Semester End Reminder',
      description: 'OJT completion deadline is in 3 weeks. Ensure all coordinators have submitted final grades.',
      time: '3 days ago',
      isUnread: false,
      hasBorder: false,
      icon: Bell,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
    },
  ]);

  const toggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isUnread: false, hasBorder: false } : item
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, isUnread: false, hasBorder: false }))
    );
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'All') return true;
    return item.type.toLowerCase() === filter.toLowerCase();
  });

  const unreadCount = notifications.filter((n) => n.isUnread).length;
  const countAlertsNew = notifications.filter((n) => n.type === 'Alerts' && n.isUnread).length;
  const countUpdatesNew = notifications.filter((n) => n.type === 'Updates' && n.isUnread).length;

  return (
    <div className="min-h-screen bg-[#F4F5F9] p-6 lg:p-10 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenSidebar}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-[#1A1D4E] hover:bg-slate-50 transition shadow-sm cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1D4E]">Notifications</h1>
            <p className="text-xs text-slate-500 mt-0.5">{unreadCount} unread notifications</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
          >
            <Check size={14} /> Mark all read
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-[#1A1D4E] hover:text-[#F5A800] transition shadow-sm cursor-pointer"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left List: Filter Pills + Notification Cards */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setFilter('All')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filter === 'All' 
                  ? 'bg-[#F5A800] text-[#1A1D4E] shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All <span className="bg-[#1A1D4E]/10 px-1.5 py-0.5 rounded-full text-[10px]">{unreadCount}</span>
            </button>
            <button
              onClick={() => setFilter('Alerts')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filter === 'Alerts' 
                  ? 'bg-[#1A1D4E] text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Alerts <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px]">{countAlertsNew}</span>
            </button>
            <button
              onClick={() => setFilter('Updates')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filter === 'Updates' 
                  ? 'bg-[#1A1D4E] text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Updates <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px]">{countUpdatesNew}</span>
            </button>
            <button
              onClick={() => setFilter('System')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition cursor-pointer ${
                filter === 'System' 
                  ? 'bg-[#1A1D4E] text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              System
            </button>
          </div>

          {/* List of Notification Cards */}
          <div className="space-y-3">
            {filteredNotifications.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => toggleRead(n.id)}
                  className={`bg-white rounded-2xl p-5 border transition cursor-pointer flex items-start gap-4 shadow-sm hover:shadow-md relative overflow-hidden ${
                    n.hasBorder 
                      ? 'border-l-4 border-l-[#F5A800] border-t-slate-100 border-r-slate-100 border-b-slate-100' 
                      : 'border-slate-100 opacity-90'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl ${n.iconBg} ${n.iconColor} flex items-center justify-center shrink-0`}>
                    <Icon size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-800">{n.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">{n.time}</span>
                        {n.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#F5A800]"></span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {n.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Summary & Tips */}
        <div className="lg:col-span-4 space-y-6">
          {/* Summary Box */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Summary</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Alerts</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">2</span>
                  {countAlertsNew > 0 && (
                    <span className="bg-amber-50 text-[#1A1D4E] font-semibold px-2 py-0.5 rounded-full text-[10px] border border-amber-200">
                      {countAlertsNew} new
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Updates</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">3</span>
                  {countUpdatesNew > 0 && (
                    <span className="bg-amber-50 text-[#1A1D4E] font-semibold px-2 py-0.5 rounded-full text-[10px] border border-amber-200">
                      {countUpdatesNew} new
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>System</span>
                <span className="font-semibold text-slate-800">1</span>
              </div>
            </div>
          </div>

          {/* Info Hint Card */}
          <div className="bg-[#FFFBF0] border border-[#FEF3C7] rounded-2xl p-5 text-amber-900 text-xs leading-relaxed shadow-sm">
            Click on a notification to mark it as read. Alerts with yellow-orange borders require attention.
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;