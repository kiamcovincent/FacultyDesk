import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RotateCcw } from 'lucide-react';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { apiRequest } from '../services/api.js';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest('/notifications?limit=100')
      .then((data) => { if (active) setNotifications(data.notifications); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  async function markRead(notificationId) {
    setBusy(notificationId);
    setError('');
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
      setNotifications((items) => items.map((item) => item._id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) return <main className="page-content"><LoadingState label="Loading notifications" /></main>;
  if (error && !notifications.length) return <main className="page-content"><ErrorState message={error} onRetry={retryLoad} /></main>;

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">FACULTYDESK INBOX</p><h2>Notifications</h2></div>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <section className="data-panel notification-panel">
        <div className="data-panel__heading"><div><p className="eyebrow">UPDATES</p><h3>Recent notifications</h3></div><span>{notifications.filter((item) => !item.readAt).length} unread</span></div>
        {notifications.length ? <div className="notification-list">{notifications.map((item) => <article className={`notification-item${item.readAt ? ' is-read' : ''}`} key={item._id}>
          <span className="notification-item__icon"><Bell size={18} aria-hidden="true" /></span>
          <div className="notification-item__body"><strong>{item.title}</strong><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>
          {!item.readAt && <Button variant="icon" aria-label={`Mark ${item.title} as read`} loading={busy === item._id} onClick={() => markRead(item._id)}><CheckCheck size={17} aria-hidden="true" /></Button>}
          {item.readAt && <span className="notification-read-label">Read</span>}
        </article>)}</div> : <EmptyState title="You’re all caught up" message="Attendance and request updates will appear here." />}
      </section>
      <div className="academic-refresh"><Button variant="secondary" onClick={retryLoad}><RotateCcw size={15} aria-hidden="true" />Refresh notifications</Button></div>
    </main>
  );
}
