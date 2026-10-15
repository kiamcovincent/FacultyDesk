import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import AccessDeniedPage from './pages/AccessDeniedPage.jsx'
import AcademicManagementPage from './pages/AcademicManagementPage.jsx'
import AuditLogPage from './pages/AuditLogPage.jsx'
import AttendanceManagementPage from './pages/AttendanceManagementPage.jsx'
import AttendancePage from './pages/AttendancePage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import SystemSettingsPage from './pages/SystemSettingsPage.jsx'
import RequestManagementPage from './pages/RequestManagementPage.jsx'
import TeacherManagementPage from './pages/TeacherManagementPage.jsx'
import { RequireAuth, RequireRole } from './routes/ProtectedRoute.jsx'
import './styles/app.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/classes" element={<AcademicManagementPage />} />
            <Route path="/requests" element={<RequestManagementPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin/dashboard" element={<DashboardPage admin />} />
              <Route path="/admin/teachers" element={<TeacherManagementPage />} />
              <Route path="/admin/attendance" element={<AttendanceManagementPage />} />
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/settings" element={<SystemSettingsPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogPage />} />
              <Route path="/admin/academics" element={<AcademicManagementPage />} />
              <Route path="/admin/requests" element={<RequestManagementPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
