import React, { useState } from 'react';
import {
  User,
  Edit,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Bell,
  Shield,
  HelpCircle,
  MessageSquare,
  LogOut,
  Menu,
  GraduationCap,
  X,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfileSettingsPage({ currentUser, onOpenSidebar, onLogout }) {
  const navigate = useNavigate();

  // Role-specific defaults
  const profileConfigs = {
    company: {
      name: 'Maria Santos',
      roleTitle: 'Company Supervisor',
      tag: 'TechVision Solutions',
      tagBg: 'bg-amber-50 text-[#b45309] border-amber-200',
      email: 'maria.santos@techvision.com',
      phone: '+63 917 234 5678',
      organization: 'TechVision Solutions',
      position: 'Senior Developer',
      stats: [
        { value: '3', label: 'Students' },
        { value: '2', label: 'Evaluations' },
        { value: '15', label: 'Reports' },
        { value: '4.5', label: 'Avg Rating' }
      ]
    },
    coordinator: {
      name: currentUser?.username || 'Faisal',
      roleTitle: 'OJT Coordinator',
      tag: 'College of Information Technology',
      tagBg: 'bg-amber-50 text-[#b45309] border-amber-200',
      email: 'ana.reyes@university.edu',
      phone: '+63 912 345 6789',
      organization: 'USTeP CDO',
      position: 'Assistant Professor / Coordinator',
      stats: [
        { value: '6', label: 'Students' },
        { value: '5', label: 'Active Interns' },
        { value: '12', label: 'Reports' },
        { value: '3', label: 'Announcements' }
      ]
    },
    dean: {
      name: 'Dr. Roberto Mendoza',
      roleTitle: 'College Dean',
      tag: 'College of Information Technology',
      tagBg: 'bg-amber-50 text-[#b45309] border-amber-200',
      email: 'dean.cit@university.edu',
      phone: '+63 918 765 4321',
      organization: 'USTeP CDO',
      position: 'Dean, College of IT',
      stats: [
        { value: '4', label: 'Departments' },
        { value: '8', label: 'Coordinators' },
        { value: '120', label: 'Active Interns' },
        { value: '98%', label: 'Placement' }
      ]
    },
    career_center: {
      name: 'Placement Officer',
      roleTitle: 'Career Services Officer',
      tag: 'Career & Placement Office',
      tagBg: 'bg-amber-50 text-[#b45309] border-amber-200',
      email: 'careercenter@university.edu',
      phone: '+63 915 888 9999',
      organization: 'USTeP Career Center',
      position: 'Industry Partnership Lead',
      stats: [
        { value: '8', label: 'Partners' },
        { value: '3', label: 'Active MOAs' },
        { value: '60', label: 'Total Slots' },
        { value: '83%', label: 'Fill Rate' }
      ]
    }
  };

  const currentRole = currentUser?.role || 'coordinator';
  const defaultProfile = profileConfigs[currentRole] || profileConfigs.coordinator;

  // Editable Profile Info State
  const [profile, setProfile] = useState(defaultProfile);

  // Modal State Controls: null | 'notifications' | 'privacy' | 'edit_profile'
  const [activeModal, setActiveModal] = useState(null);

  // Notification Toggles State
  const [notifications, setNotifications] = useState({
    studentReports: true,
    attendanceAlerts: true,
    evaluationReminders: true,
    systemNotifications: false
  });

  // Edit Profile Form State
  const [editFormData, setEditFormData] = useState({
    name: defaultProfile.name,
    email: defaultProfile.email,
    phone: defaultProfile.phone
  });

  const openEditModal = () => {
    setEditFormData({
      name: profile.name,
      email: profile.email,
      phone: profile.phone
    });
    setActiveModal('edit_profile');
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfile((prev) => ({
      ...prev,
      name: editFormData.name,
      email: editFormData.email,
      phone: editFormData.phone
    }));
    setActiveModal(null);
  };

  const toggleNotification = (key) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
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
                  Profile & Settings
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40 uppercase">
                  <GraduationCap className="w-3 h-3" /> {currentRole.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Manage your account and preferences
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Back
            </button>
            <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#1a1642] font-black flex items-center justify-center text-sm shadow">
              {profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
            Profile & Settings
          </h2>
          <p className="text-xs text-slate-200 mt-0.5 drop-shadow-xs">
            Manage your account and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-4">
            {/* User Profile Card */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col items-center text-center">
              {/* Mustard Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-[#f59e0b]/15 text-[#f59e0b] flex items-center justify-center mb-3">
                <User className="w-10 h-10" />
              </div>

              <h3 className="text-lg font-bold text-slate-800">{profile.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{profile.roleTitle}</p>

              <div className="mt-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${profile.tagBg}`}>
                  {profile.tag}
                </span>
              </div>

              <button
                onClick={openEditModal}
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#b45309] hover:bg-[#fef3c7] transition-colors cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Profile
              </button>
            </div>

            {/* Personal Info Box */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Personal Info
              </span>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-400 text-[10px] block">Email</span>
                  <span className="font-semibold text-slate-700">{profile.email}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-400 text-[10px] block">Phone</span>
                  <span className="font-semibold text-slate-700">{profile.phone}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-400 text-[10px] block">Company / Dept</span>
                  <span className="font-semibold text-slate-700">{profile.organization}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-400 text-[10px] block">Position</span>
                  <span className="font-semibold text-slate-700">{profile.position}</span>
                </div>
              </div>
            </div>

            {/* Stats Box (Mustard styled) */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                My OJT Stats
              </span>

              <div className="grid grid-cols-2 gap-3">
                {profile.stats.map((stat, idx) => (
                  <div key={idx} className="bg-[#fef3c7]/40 border border-amber-200/80 rounded-xl p-3 text-center">
                    <span className="text-xl font-black text-[#b45309] block leading-tight">
                      {stat.value}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Log Out Button */}
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/95 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Account Settings Box */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Account Settings</h3>

              <div className="divide-y divide-slate-100">
                {/* Notifications row */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-[#f59e0b]">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Notifications</h4>
                      <p className="text-[11px] text-slate-400">Manage notification preferences</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModal('notifications')}
                    className="text-xs font-bold text-[#b45309] hover:text-[#d97706] cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                {/* Privacy & Security row */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-[#f59e0b]">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Privacy & Security</h4>
                      <p className="text-[11px] text-slate-400">Password and data privacy settings</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModal('privacy')}
                    className="text-xs font-bold text-[#b45309] hover:text-[#d97706] cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                {/* Edit Profile row */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-[#f59e0b]">
                      <Edit className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Edit Profile</h4>
                      <p className="text-[11px] text-slate-400">Update your name, email, and phone</p>
                    </div>
                  </div>
                  <button
                    onClick={openEditModal}
                    className="text-xs font-bold text-[#b45309] hover:text-[#d97706] cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>

            {/* Support Box */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Support</h3>

              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Help Center</h4>
                      <p className="text-[11px] text-slate-400">Guides and documentation</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Contact Support</h4>
                      <p className="text-[11px] text-slate-400">Send us a message</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 pt-2">
              OJT Monitoring System v1.0 · © 2026 All rights reserved
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL 1: NOTIFICATION SETTINGS                            */}
      {/* ========================================================= */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Notification Settings</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Row 1: Student Reports */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Student Reports</h4>
                  <p className="text-[11px] text-slate-400">Notify when students submit reports</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotification('studentReports')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    notifications.studentReports ? 'bg-[#f59e0b]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      notifications.studentReports ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Row 2: Attendance Alerts */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Attendance Alerts</h4>
                  <p className="text-[11px] text-slate-400">Get alerts for attendance issues</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotification('attendanceAlerts')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    notifications.attendanceAlerts ? 'bg-[#f59e0b]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      notifications.attendanceAlerts ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Row 3: Evaluation Reminders */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Evaluation Reminders</h4>
                  <p className="text-[11px] text-slate-400">Reminders for pending evaluations</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotification('evaluationReminders')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    notifications.evaluationReminders ? 'bg-[#f59e0b]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      notifications.evaluationReminders ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Row 4: System Notifications */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">System Notifications</h4>
                  <p className="text-[11px] text-slate-400">General system updates</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotification('systemNotifications')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    notifications.systemNotifications ? 'bg-[#f59e0b]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      notifications.systemNotifications ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 rounded-2xl bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: PRIVACY & SECURITY                               */}
      {/* ========================================================= */}
      {activeModal === 'privacy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Privacy & Security</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => alert('Change Password flow triggered')}
                className="w-full p-4 rounded-2xl bg-slate-50/70 hover:bg-amber-50/60 text-left text-xs font-bold text-slate-700 hover:text-[#b45309] transition-all cursor-pointer"
              >
                Change Password
              </button>

              <button
                onClick={() => alert('Two-Factor Authentication flow triggered')}
                className="w-full p-4 rounded-2xl bg-slate-50/70 hover:bg-amber-50/60 text-left text-xs font-bold text-slate-700 hover:text-[#b45309] transition-all cursor-pointer"
              >
                Two-Factor Authentication
              </button>

              <button
                onClick={() => alert('Data Export triggered')}
                className="w-full p-4 rounded-2xl bg-slate-50/70 hover:bg-amber-50/60 text-left text-xs font-bold text-slate-700 hover:text-[#b45309] transition-all cursor-pointer"
              >
                Data Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: EDIT PROFILE                                     */}
      {/* ========================================================= */}
      {activeModal === 'edit_profile' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Edit Profile</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Phone Number</label>
                <input
                  type="text"
                  required
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}