import React, { useState } from 'react';
import DepartmentDashboard from './DepartmentDashboard';
import CoordinatorsPage from './CoordinatorsPage';
import CoordinatorDetailPage from './CoordinatorDetailPage';
import NotificationsPage from './NotificationsPage';
import Sidebar from './Sidebar';

function App() {
  const [currentPage, setCurrentPage] = useState('overview');
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSelectCoordinator = (coordinator) => {
    setSelectedCoordinator(coordinator);
    setCurrentPage('coordinator-detail');
  };

  return (
    <div className="relative">
      {/* Slide-out Sidebar Drawer */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
      />

      {/* Main App Screens */}
      {currentPage === 'overview' && (
        <DepartmentDashboard 
          onNavigate={setCurrentPage} 
          onOpenSidebar={() => setIsSidebarOpen(true)}
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

      {currentPage === 'notifications' && (
        <NotificationsPage 
          onBack={() => setCurrentPage('overview')} 
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      )}
    </div>
  );
}

export default App;