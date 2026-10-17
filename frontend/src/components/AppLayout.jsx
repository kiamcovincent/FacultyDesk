import {
  CalendarCheck2,
  BookOpenCheck,
  ClipboardList,
  FileCheck2,
  Bell,
  LayoutDashboard,
  LogOut,
  ChartColumn,
  Settings2,
  ScrollText,
  UsersRound,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import Button from './Button.jsx';

const teacherItems = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/attendance', label: 'Attendance', Icon: CalendarCheck2 },
  { to: '/history', label: 'My history', Icon: ClipboardList },
  { to: '/workflow', label: 'Teaching setup', Icon: BookOpenCheck },
  { to: '/requests', label: 'Requests', Icon: FileCheck2 },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
];

const adminItems = [
  { to: '/admin/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { to: '/admin/teachers', label: 'Teachers', Icon: UsersRound },
  { to: '/admin/attendance', label: 'Attendance', Icon: CalendarCheck2 },
  { to: '/admin/reports', label: 'Reports', Icon: ChartColumn },
  { to: '/admin/settings', label: 'Settings', Icon: Settings2 },
  { to: '/admin/audit-logs', label: 'Audit logs', Icon: ScrollText },
  { to: '/admin/academics', label: 'Subjects & schedules', Icon: BookOpenCheck },
  { to: '/admin/requests', label: 'Request review', Icon: FileCheck2 },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = user.role === 'admin' ? adminItems : teacherItems;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="/dashboard" aria-label="FacultyDesk dashboard">
          <span className="brand__mark">F</span>
          <span className="brand__copy">
            <strong>FacultyDesk</strong>
            <small>Attendance management</small>
          </span>
        </a>

        <div className="sidebar__label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {items.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `side-nav__link${isActive ? ' is-active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <div className="profile-chip">
            <span className="profile-chip__avatar" aria-hidden="true">{user.name?.charAt(0)?.toUpperCase() || 'F'}</span>
            <span className="profile-chip__text">
              <strong>{user.name}</strong>
              <small>{user.role === 'admin' ? 'Administrator' : 'Teacher'}</small>
            </span>
          </div>
          <Button variant="secondary" className="logout-button" onClick={handleLogout}>
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </Button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="topbar__eyebrow">FACULTYDESK / {user.role === 'admin' ? 'ADMINISTRATION' : 'TEACHER'}</div>
            <h1>{user.role === 'admin' ? 'School overview' : 'Your workspace'}</h1>
          </div>
          <div className="topbar__identity">
            <span className="system-indicator"><i /> API session</span>
            <span className="topbar__name">{user.name}</span>
            <Button variant="icon" className="topbar-logout" aria-label="Sign out" title="Sign out" onClick={handleLogout}>
              <LogOut size={17} aria-hidden="true" />
            </Button>
          </div>
        </header>
        <div className="route-stage"><Outlet /></div>
      </main>
    </div>
  );
}
