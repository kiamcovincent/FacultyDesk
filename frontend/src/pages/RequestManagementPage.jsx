import { useEffect, useState } from 'react';
import { Check, FilePlus2, X } from 'lucide-react';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { apiRequest } from '../services/api.js';

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toApiDateTime(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function RequestStatus({ status }) {
  return <span className={`record-status record-status--${status}`}>{status}</span>;
}

export default function RequestManagementPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState({ leaves: [], corrections: [], attendance: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState('');
  const [requestType, setRequestType] = useState('leave');
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [correctionForm, setCorrectionForm] = useState({ attendance: '', requestedCheckIn: '', requestedCheckOut: '', reason: '' });
  const [reviewNotes, setReviewNotes] = useState({});

  useEffect(() => {
    let active = true;
    const requests = isAdmin
      ? Promise.all([
          apiRequest('/leave-requests?status=pending&limit=100'),
          apiRequest('/correction-requests?status=pending&limit=100'),
        ]).then(([leaves, corrections]) => ({ leaves: leaves.requests, corrections: corrections.requests, attendance: [] }))
      : Promise.all([
          apiRequest('/leave-requests?limit=100'),
          apiRequest('/correction-requests?limit=100'),
          apiRequest('/attendance/my-history?limit=100'),
        ]).then(([leaves, corrections, attendance]) => ({ leaves: leaves.requests, corrections: corrections.requests, attendance: attendance.records }));

    requests
      .then((result) => { if (active) setData(result); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [isAdmin, refresh]);

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  async function submitRequest(event) {
    event.preventDefault();
    setBusy('submit');
    setActionError('');
    setNotice('');
    try {
      if (requestType === 'leave') {
        await apiRequest('/leave-requests', { method: 'POST', body: leaveForm });
        setLeaveForm({ startDate: '', endDate: '', reason: '' });
        setNotice('Leave request submitted for review.');
      } else {
        const body = {
          attendance: correctionForm.attendance,
          reason: correctionForm.reason,
        };
        if (correctionForm.requestedCheckIn) body.requestedCheckIn = toApiDateTime(correctionForm.requestedCheckIn);
        if (correctionForm.requestedCheckOut) body.requestedCheckOut = toApiDateTime(correctionForm.requestedCheckOut);
        await apiRequest('/correction-requests', { method: 'POST', body });
        setCorrectionForm({ attendance: '', requestedCheckIn: '', requestedCheckOut: '', reason: '' });
        setNotice('Correction request submitted for review.');
      }
      setLoading(true);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function reviewRequest(type, requestId, status) {
    const path = type === 'leave' ? 'leave-requests' : 'correction-requests';
    setBusy(requestId);
    setActionError('');
    setNotice('');
    try {
      await apiRequest(`/${path}/${requestId}/review`, {
        method: 'PATCH',
        body: { status, reviewerNote: reviewNotes[requestId] || '' },
      });
      setNotice(`Request ${status}.`);
      setLoading(true);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) return <main className="page-content"><LoadingState label="Loading requests" /></main>;
  if (error) return <main className="page-content"><ErrorState message={error} onRetry={retryLoad} /></main>;

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">{isAdmin ? 'ADMINISTRATION' : 'TEACHER WORKSPACE'}</p><h2>{isAdmin ? 'Request review' : 'Leave & corrections'}</h2></div>
      {actionError && <p className="form-alert" role="alert">{actionError}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {!isAdmin ? (
        <>
          <section className="data-panel request-form-panel">
            <div className="data-panel__heading"><div><p className="eyebrow">SUBMIT A REQUEST</p><h3>What do you need reviewed?</h3></div><FilePlus2 size={19} aria-hidden="true" /></div>
            <div className="request-tabs" role="group" aria-label="Request type">
              <button type="button" className={requestType === 'leave' ? 'is-selected' : ''} onClick={() => setRequestType('leave')}>Leave request</button>
              <button type="button" className={requestType === 'correction' ? 'is-selected' : ''} onClick={() => setRequestType('correction')}>Attendance correction</button>
            </div>

            {requestType === 'leave' ? (
              <form className="request-form" onSubmit={submitRequest}>
                <label className="field"><span>First day</span><input type="date" required value={leaveForm.startDate} onChange={(event) => setLeaveForm({ ...leaveForm, startDate: event.target.value })} /></label>
                <label className="field"><span>Last day</span><input type="date" min={leaveForm.startDate || undefined} required value={leaveForm.endDate} onChange={(event) => setLeaveForm({ ...leaveForm, endDate: event.target.value })} /></label>
                <label className="field request-form__reason"><span>Reason</span><textarea required minLength={5} maxLength={1000} rows={3} value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} /></label>
                <Button type="submit" loading={busy === 'submit'}>Submit leave request</Button>
              </form>
            ) : (
              <form className="request-form" onSubmit={submitRequest}>
                <label className="field request-form__wide"><span>Attendance date</span><select required value={correctionForm.attendance} onChange={(event) => {
                  const record = data.attendance.find((item) => item._id === event.target.value);
                  setCorrectionForm({
                    ...correctionForm,
                    attendance: event.target.value,
                    requestedCheckIn: toDateTimeInput(record?.checkIn),
                    requestedCheckOut: toDateTimeInput(record?.checkOut),
                  });
                }}><option value="">Select a record</option>{data.attendance.map((record) => <option key={record._id} value={record._id}>{record.date} · {record.status}</option>)}</select></label>
                <label className="field"><span>Correct check-in</span><input type="datetime-local" value={correctionForm.requestedCheckIn} onChange={(event) => setCorrectionForm({ ...correctionForm, requestedCheckIn: event.target.value })} /></label>
                <label className="field"><span>Correct check-out</span><input type="datetime-local" value={correctionForm.requestedCheckOut} onChange={(event) => setCorrectionForm({ ...correctionForm, requestedCheckOut: event.target.value })} /></label>
                <label className="field request-form__reason"><span>Reason</span><textarea required minLength={5} maxLength={1000} rows={3} value={correctionForm.reason} onChange={(event) => setCorrectionForm({ ...correctionForm, reason: event.target.value })} /></label>
                <Button type="submit" loading={busy === 'submit'} disabled={!correctionForm.attendance || (!correctionForm.requestedCheckIn && !correctionForm.requestedCheckOut)}>Submit correction</Button>
              </form>
            )}
          </section>

          <section className="request-record-grid">
            <RequestList title="My leave requests" requests={data.leaves} type="leave" />
            <RequestList title="My correction requests" requests={data.corrections} type="correction" />
          </section>
        </>
      ) : (
        <section className="request-review-grid">
          <ReviewList type="leave" title="Leave requests" requests={data.leaves} busy={busy} reviewNotes={reviewNotes} setReviewNotes={setReviewNotes} onReview={reviewRequest} />
          <ReviewList type="correction" title="Attendance corrections" requests={data.corrections} busy={busy} reviewNotes={reviewNotes} setReviewNotes={setReviewNotes} onReview={reviewRequest} />
        </section>
      )}
    </main>
  );
}

function RequestList({ title, requests, type }) {
  return (
    <section className="data-panel request-list-panel">
      <div className="data-panel__heading"><h3>{title}</h3><span>{requests.length}</span></div>
      {requests.length ? <div className="request-list">{requests.map((item) => <article className="request-item" key={item._id}>
        <div className="request-item__heading"><strong>{type === 'leave' ? `${item.startDate.slice(0, 10)} – ${item.endDate.slice(0, 10)}` : item.attendance?.date}</strong><RequestStatus status={item.status} /></div>
        <p>{item.reason}</p>
        {item.reviewerNote && <small>Review note: {item.reviewerNote}</small>}
      </article>)}</div> : <EmptyState title="No requests" message="Requests you submit will appear here." />}
    </section>
  );
}

function ReviewList({ type, title, requests, busy, reviewNotes, setReviewNotes, onReview }) {
  return (
    <section className="data-panel request-list-panel">
      <div className="data-panel__heading"><div><p className="eyebrow">PENDING</p><h3>{title}</h3></div><span>{requests.length}</span></div>
      {requests.length ? <div className="request-list">{requests.map((item) => <article className="request-item request-item--review" key={item._id}>
        <div className="request-item__heading"><strong>{item.teacher?.name || 'Teacher'}</strong><RequestStatus status={item.status} /></div>
        <p className="request-item__meta">{type === 'leave' ? `${item.startDate.slice(0, 10)} – ${item.endDate.slice(0, 10)}` : `${item.attendance?.date || 'Attendance'} · correction`}</p>
        <p>{item.reason}</p>
        {type === 'correction' && <p className="request-item__meta">Requested: {item.requestedCheckIn ? new Date(item.requestedCheckIn).toLocaleString() : 'Check-in unchanged'} / {item.requestedCheckOut ? new Date(item.requestedCheckOut).toLocaleString() : 'Check-out unchanged'}</p>}
        <label className="field"><span>Review note <small>Optional</small></span><textarea rows={2} maxLength={1000} value={reviewNotes[item._id] || ''} onChange={(event) => setReviewNotes({ ...reviewNotes, [item._id]: event.target.value })} /></label>
        <div className="request-review-actions">
          <Button variant="primary" loading={busy === item._id} onClick={() => onReview(type, item._id, 'approved')}><Check size={15} aria-hidden="true" />Approve</Button>
          <Button variant="secondary" disabled={busy === item._id} onClick={() => onReview(type, item._id, 'rejected')}><X size={15} aria-hidden="true" />Reject</Button>
        </div>
      </article>)}</div> : <EmptyState title="Queue is clear" message="New teacher requests will appear here." />}
    </section>
  );
}
