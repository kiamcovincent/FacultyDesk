import { useEffect, useState } from 'react';
import { CalendarClock, Check, LogIn, LogOut } from 'lucide-react';
import Button from '../components/Button.jsx';
import { ErrorState, LoadingState } from '../components/DataState.jsx';
import { apiRequest } from '../services/api.js';

const statusNames = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  approved_leave: 'Approved leave',
};

export default function AttendancePage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest('/dashboard')
      .then((data) => { if (active) setDashboard(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function recordAttendance(kind) {
    setAction(kind);
    setActionError('');
    setNotice('');
    try {
      const response = await apiRequest(`/attendance/${kind}`, { method: 'POST' });
      setNotice(response.message);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setAction('');
    }
  }

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  if (loading) return <main className="page-content"><LoadingState label="Loading today’s attendance" /></main>;
  if (error) return <main className="page-content"><ErrorState message={error} onRetry={retryLoad} /></main>;

  const today = dashboard.today;
  const checkedIn = Boolean(today?.checkIn);
  const checkedOut = Boolean(today?.checkOut);
  const status = dashboard.todayStatus;

  return (
    <main className="page-content">
      <div className="page-heading">
        <p className="eyebrow">{dashboard.date}</p>
        <h2>Attendance check-in</h2>
      </div>
      <section className="attendance-panel">
        <div className="attendance-panel__header">
          <div className="attendance-panel__icon"><CalendarClock size={21} aria-hidden="true" /></div>
          <div><span className="muted-label">TODAY’S STATUS</span><strong>{status ? statusNames[status] : 'Not checked in'}</strong></div>
          <span className={`record-status record-status--${status || 'pending'}`}>{status ? statusNames[status] : 'Pending'}</span>
        </div>
        <div className="attendance-times">
          <div><span>Check-in</span><strong>{today?.checkIn ? new Date(today.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
          <div><span>Check-out</span><strong>{today?.checkOut ? new Date(today.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
          <div><span>Work hours</span><strong>{dashboard.settings.workStartTime} – {dashboard.settings.workEndTime}</strong></div>
        </div>
        <div className="attendance-actions">
          <Button onClick={() => recordAttendance('check-in')} loading={action === 'check-in'} disabled={checkedIn || checkedOut || status === 'approved_leave' || status === 'absent'}>
            {checkedIn ? <Check size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
            {checkedIn ? 'Checked in' : 'Check in'}
          </Button>
          <Button variant="secondary" onClick={() => recordAttendance('check-out')} loading={action === 'check-out'} disabled={!checkedIn || checkedOut}>
            {checkedOut ? <Check size={17} aria-hidden="true" /> : <LogOut size={17} aria-hidden="true" />}
            {checkedOut ? 'Checked out' : 'Check out'}
          </Button>
        </div>
        {actionError && <p className="form-alert" role="alert">{actionError}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
      </section>
    </main>
  );
}
