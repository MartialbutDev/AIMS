import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import bgImage from './assets/ustp-bg.jpg';

// Auth
import LoginPage from './auth/LoginPage';

// Dean Interface
import DepartmentDashboard from './dean/DepartmentDashboard';
import CoordinatorsPage from './dean/CoordinatorsPage';
import CoordinatorDetailPage from './dean/CoordinatorDetailPage';
import NotificationsPage from './dean/NotificationsPage';
import Sidebar from './dean/Sidebar';

// Coordinator Interface
import CoordinatorDashboard from './coordinator/CoordinatorDashboard';
import CoordinatorStudentsPage from './coordinator/CoordinatorStudentsPage';
import StudentDetailPage from './coordinator/StudentDetailPage';
import CoordinatorReportsPage from './coordinator/CoordinatorReportsPage';
import CoordinatorEvaluationsPage from './coordinator/CoordinatorEvaluationsPage';
import CoordinatorSidebar from './coordinator/CoordinatorSidebar';

// Host Company Interface
import CompanyDashboard from './company/CompanyDashboard';
import CompanySidebar from './company/CompanySidebar';

// Career Center Interface
import CareerCenterDashboard from './career/CareerCenterDashboard';
import CareerCenterSidebar from './career/CareerCenterSidebar';
import PartnerCompaniesPage from './career/PartnerCompaniesPage';
import StudentsPlacedPage from './career/StudentsPlacedPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const handleLoginSuccess = ({ role, username }) => {
    setCurrentUser({ role, username });

    switch (role) {
      case 'dean':
        navigate('/dean/overview');
        break;
      case 'coordinator':
        navigate('/coordinator/dashboard');
        break;
      case 'company':
        navigate('/company/dashboard');
        break;
      case 'career_center':
        navigate('/career-center');
        break;
      case 'admin':
        navigate('/admin/dashboard');
        break;
      default:
        navigate('/login');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsSidebarOpen(false);
    navigate('/login');
  };

  const handleSelectCoordinator = (coord) => {
    setSelectedCoordinator(coord);
    navigate('/dean/coordinator-detail');
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    navigate('/coordinator/student-detail');
  };

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center bg-fixed bg-no-repeat"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="min-h-screen w-full bg-[#0e0a26]/40 backdrop-blur-[1px]">
        {/* SIDEBARS */}
        {currentUser && (
          <>
            <Sidebar
              isOpen={isSidebarOpen && currentUser.role === 'dean'}
              onClose={() => setIsSidebarOpen(false)}
              currentPage={location.pathname}
              onNavigate={(path) => navigate(path)}
              onLogout={handleLogout}
            />

            <CoordinatorSidebar
              isOpen={isSidebarOpen && currentUser.role === 'coordinator'}
              onClose={() => setIsSidebarOpen(false)}
              currentPage={location.pathname}
              onNavigate={(path) => navigate(path)}
              onLogout={handleLogout}
            />

            <CompanySidebar
              isOpen={isSidebarOpen && currentUser.role === 'company'}
              onClose={() => setIsSidebarOpen(false)}
              currentPage={location.pathname}
              onNavigate={(path) => navigate(path)}
              onLogout={handleLogout}
            />

            <CareerCenterSidebar
              isOpen={isSidebarOpen && currentUser.role === 'career_center'}
              onClose={() => setIsSidebarOpen(false)}
              currentPage={location.pathname}
              onNavigate={(path) => navigate(path)}
              onLogout={handleLogout}
            />
          </>
        )}

        {/* ROUTES */}
        <Routes>
          <Route
            path="/login"
            element={
              currentUser ? (
                <Navigate
                  to={
                    currentUser.role === 'dean'
                      ? '/dean/overview'
                      : currentUser.role === 'coordinator'
                      ? '/coordinator/dashboard'
                      : currentUser.role === 'company'
                      ? '/company/dashboard'
                      : currentUser.role === 'career_center'
                      ? '/career-center'
                      : '/admin/dashboard'
                  }
                  replace
                />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          {/* Dean Routes */}
          <Route
            path="/dean/overview"
            element={
              <DepartmentDashboard
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/dean/coordinators"
            element={
              <CoordinatorsPage
                onBack={() => navigate('/dean/overview')}
                onSelectCoordinator={handleSelectCoordinator}
                onOpenSidebar={() => setIsSidebarOpen(true)}
              />
            }
          />
          <Route
            path="/dean/coordinator-detail"
            element={
              <CoordinatorDetailPage
                coordinator={selectedCoordinator}
                onBack={() => navigate('/dean/coordinators')}
              />
            }
          />
          <Route
            path="/dean/notifications"
            element={
              <NotificationsPage
                onBack={() => navigate('/dean/overview')}
                onOpenSidebar={() => setIsSidebarOpen(true)}
              />
            }
          />

          {/* Coordinator Routes */}
          <Route
            path="/coordinator/dashboard"
            element={
              <CoordinatorDashboard
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/coordinator/students"
            element={
              <CoordinatorStudentsPage
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onSelectStudent={handleSelectStudent}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/coordinator/student-detail"
            element={
              <StudentDetailPage
                student={selectedStudent}
                onBack={() => navigate('/coordinator/students')}
              />
            }
          />
          <Route
            path="/coordinator/reports"
            element={
              <CoordinatorReportsPage
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/coordinator/evaluations"
            element={
              <CoordinatorEvaluationsPage
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onSelectStudent={handleSelectStudent}
                onLogout={handleLogout}
              />
            }
          />

          {/* Host Company Routes */}
          <Route
            path="/company/dashboard"
            element={
              <CompanyDashboard
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            }
          />

          {/* Career Center Routes */}
          <Route
            path="/career-center"
            element={
              <CareerCenterDashboard
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/career-center/partners"
            element={
              <PartnerCompaniesPage
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/career-center/placements"
            element={
              <StudentsPlacedPage
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
              />
            }
          />

          {/* Admin Route */}
          <Route
            path="/admin/dashboard"
            element={
              <div className="p-12 text-center text-white">
                <h2 className="text-2xl font-bold text-[#f59e0b]">Admin Portal</h2>
                <button
                  onClick={handleLogout}
                  className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Logout
                </button>
              </div>
            }
          />

          {/* Default Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  );
}