import React, { useState } from 'react';
import bgImage from './assets/ustp-bg.jpg';

import LoginPage from './LoginPage';
import DepartmentDashboard from './DepartmentDashboard';
import CoordinatorDashboard from './CoordinatorDashboard';
import CoordinatorsPage from './CoordinatorsPage';
import CoordinatorDetailPage from './CoordinatorDetailPage';
import NotificationsPage from './NotificationsPage';
import Sidebar from './Sidebar';
import CoordinatorSidebar from './CoordinatorSidebar';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('overview');
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLoginSuccess = ({ role, username }) => {
    setCurrentUser({ role, username });

    switch (role) {
      case 'dean':
        setCurrentPage('overview');
        break;
      case 'coordinator':
        setCurrentPage('coordinator-dashboard');
        break;
      case 'career_center':
        setCurrentPage('career-center');
        break;
      case 'company':
        setCurrentPage('company-dashboard');
        break;
      case 'admin':
        setCurrentPage('admin-dashboard');
        break;
      default:
        setCurrentPage('overview');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('login');
  };

  const handleSelectCoordinator = (coordinator) => {
    setSelectedCoordinator(coordinator);
    setCurrentPage('coordinator-detail');
  };

  return (
    <div
      className="relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Background Overlay: Deep USTeP Navy gradient to maintain high contrast */}
      <div className="min-h-screen bg-[#0e0a26]/40">

        {/* --- NOT LOGGED IN --- */}
        {!currentUser && (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )}

        {/* --- LOGGED IN PORTALS --- */}
        {currentUser && (
          <>
            {/* Dean Sidebar Drawer */}
            <Sidebar 
              isOpen={isSidebarOpen && currentUser.role === 'dean'} 
              onClose={() => setIsSidebarOpen(false)} 
              currentPage={currentPage}
              userRole={currentUser.role}
              onNavigate={(page) => setCurrentPage(page)}
              onLogout={handleLogout}
            />

            {/* Coordinator Sidebar Drawer */}
            <CoordinatorSidebar 
              isOpen={isSidebarOpen && currentUser.role === 'coordinator'} 
              onClose={() => setIsSidebarOpen(false)} 
              currentPage={currentPage}
              onNavigate={(page) => setCurrentPage(page)}
              onLogout={handleLogout}
            />

            {/* Dean Screens */}
            {currentPage === 'overview' && (
              <DepartmentDashboard 
                onNavigate={setCurrentPage} 
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            )}

            {currentPage === 'coordinators' && (
              <CoordinatorsPage 
                onBack={() => setCurrentPage('overview')} 
                onSelectCoordinator={handleSelectCoordinator}
                onOpenSidebar={() => setIsSidebarOpen(true)}
              />
            )}

            {currentPage === 'coordinator-detail' && selectedCoordinator && (
              <CoordinatorDetailPage 
                coordinator={selectedCoordinator} 
                onBack={() => setCurrentPage('coordinators')} 
              />
            )}

            {/* Coordinator Screen */}
            {currentPage === 'coordinator-dashboard' && (
              <CoordinatorDashboard 
                onNavigate={setCurrentPage}
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            )}

            {/* Notifications */}
            {currentPage === 'notifications' && (
              <NotificationsPage 
                onBack={() => setCurrentPage(currentUser.role === 'coordinator' ? 'coordinator-dashboard' : 'overview')} 
                onOpenSidebar={() => setIsSidebarOpen(true)}
              />
            )}

            {/* Placeholders for Upcoming Interfaces */}
            {currentPage === 'career-center' && (
              <div className="p-12 text-center text-white">
                <h2 className="text-2xl font-bold text-[#f59e0b]">Career Center Portal</h2>
                <p className="text-slate-300 text-sm mt-2">Ready to build the Industry Matching interface here.</p>
                <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all">Logout</button>
              </div>
            )}

            {currentPage === 'company-dashboard' && (
              <div className="p-12 text-center text-white">
                <h2 className="text-2xl font-bold text-[#f59e0b]">Host Company Portal</h2>
                <p className="text-slate-300 text-sm mt-2">Ready to build the Student Evaluation & Attendance interface here.</p>
                <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all">Logout</button>
              </div>
            )}

            {currentPage === 'admin-dashboard' && (
              <div className="p-12 text-center text-white">
                <h2 className="text-2xl font-bold text-[#f59e0b]">Admin Portal</h2>
                <p className="text-slate-300 text-sm mt-2">Ready to build the System Administration interface here.</p>
                <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all">Logout</button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default App;