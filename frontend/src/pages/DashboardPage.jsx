import { ArrowUpRight, CalendarCheck2, ClipboardList, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AttendanceTable from '../components/AttendanceTable.jsx';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { apiRequest } from '../services/api.js';

export default function DashboardPage({ admin = false }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest(admin ? '/dashboard/admin' : '/dashboard')
      .then((data) => { if (active) setDashboard(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, refresh]);

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  if (loading) return <main className="page-content"><LoadingState label="Loading dashboard" /></main>;
  if (error) return <main className="page-content"><ErrorState message={error} onRetry={retryLoad} /></main>;

  if (admin) {
    const { summary } = dashboard;
    const metrics = [
      { label: 'Active teachers', value: summary.totalTeachers, tone: 'blue' },
      { label: 'Present', value: summary.present, tone: 'green' },
      { label: 'Late', value: summary.late, tone: 'amber' },
      { label: 'Absent', value: summary.absent, tone: 'red' },
      { label: 'Pending requests', value: summary.pendingRequests, tone: 'amber' },
    ];

    return (
      <main className="page-content">
        <section className="welcome-band">
          <div><p className="eyebrow">ADMINISTRATOR / {dashboard.date}</p><h2>School attendance overview</h2><p>Live attendance totals and activity from the FacultyDesk database.</p></div>
          <div className="welcome-band__seal" aria-hidden="true"><ShieldCheck size={30} strokeWidth={1.5} /></div>
        </section>
        <section className="metric-grid" aria-label="Attendance totals">
          {metrics.map((metric) => <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}
        </section>
        <section className="data-panel">
          <div className="data-panel__heading"><div><p className="eyebrow">TODAY</p><h3>Recent attendance activity</h3></div><Link className="text-action" to="/admin/attendance">All attendance <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
          {dashboard.recentAttendance.length ? <AttendanceTable records={dashboard.recentAttendance} admin /> : <EmptyState title="No attendance recorded" message="Today’s attendance activity will appear here." />}
        </section>
      </main>
    );
  }

  const { summary } = dashboard;
  const metrics = [
    { label: 'Present days', value: summary.presentDays, tone: 'green' },
    { label: 'Late arrivals', value: summary.lateDays, tone: 'amber' },
    { label: 'Absences', value: summary.absentDays, tone: 'red' },
    { label: 'Attendance rate', value: `${summary.attendanceRate}%`, tone: 'blue' },
  ];
  const status = dashboard.todayStatus?.replace('_', ' ') || 'Not checked in';

  return (
    <div className="page-content">
      <section className="welcome-band">
        <div>
          <p className="eyebrow">TEACHER WORKSPACE / {dashboard.date}</p>
          <h2>Good to see you, {user.name.split(' ')[0]}.</h2>
          <p>Today’s attendance is <strong className="status-inline">{status}</strong>. Your summary is calculated from your own attendance records.</p>
        </div>
        <div className="welcome-band__seal" aria-hidden="true"><ShieldCheck size={30} strokeWidth={1.5} /></div>
      </section>

      <section className="metric-grid" aria-label="Monthly attendance summary">
        {metrics.map((metric) => <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}
      </section>

      <section className="workspace-grid" aria-label="Workspace navigation">
        <Link className="workspace-link" to="/attendance">
          <span className="workspace-link__icon"><CalendarCheck2 size={19} aria-hidden="true" /></span>
          <span><strong>Attendance</strong><small>Check in or out for today</small></span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <Link className="workspace-link" to="/history">
          <span className="workspace-link__icon"><ClipboardList size={19} aria-hidden="true" /></span>
          <span><strong>My history</strong><small>Review your attendance records</small></span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="data-panel">
        <div className="data-panel__heading"><div><p className="eyebrow">PERSONAL RECORDS</p><h3>Recent attendance</h3></div><Link className="text-action" to="/history">View history <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        {dashboard.recentAttendance.length ? <AttendanceTable records={dashboard.recentAttendance} /> : <EmptyState title="No attendance records yet" message="Your check-ins and attendance history will appear here." />}
        <div className="dashboard-action"><Button variant="secondary" onClick={() => setRefresh((value) => value + 1)}>Refresh summary</Button></div>
      </section>
    </div>
  );
}
