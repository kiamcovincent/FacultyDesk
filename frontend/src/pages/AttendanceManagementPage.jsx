import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import AttendanceTable from '../components/AttendanceTable.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { apiRequest } from '../services/api.js';

export default function AttendanceManagementPage() {
  const [filter, setFilter] = useState({ date: '', status: '' });
  const [query, setQuery] = useState({ date: '', status: '', page: 1 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(query.page), limit: '20' });
    if (query.date) params.set('date', query.date);
    if (query.status) params.set('status', query.status);
    apiRequest(`/attendance?${params}`)
      .then((data) => { if (active) setResult(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, refresh]);

  function applyFilter(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setQuery({ ...filter, page: 1 });
  }

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h2>Attendance management</h2></div>
      <section className="data-panel">
        <div className="data-panel__heading"><h3>School attendance</h3>{result && <span>{result.pagination.total} records</span>}</div>
        <form className="filter-bar filter-bar--compact" onSubmit={applyFilter}>
          <label className="field"><span>Date</span><input type="date" value={filter.date} onChange={(event) => setFilter({ ...filter, date: event.target.value })} /></label>
          <label className="field"><span>Status</span><select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })}><option value="">All statuses</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="approved_leave">Approved leave</option></select></label>
          <Button type="submit" variant="secondary">Apply filters</Button>
        </form>
        {loading ? <LoadingState label="Loading school attendance" /> : error ? <ErrorState message={error} onRetry={retryLoad} /> : result.records.length === 0 ? <EmptyState title="No attendance records" message="There are no records matching these filters." /> : <AttendanceTable records={result.records} admin />}
        {result?.pagination.pages > 1 && <div className="pagination-bar"><Button variant="secondary" disabled={query.page <= 1} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page - 1 }); }}>Previous</Button><span>Page {result.pagination.page} of {result.pagination.pages}</span><Button variant="secondary" disabled={query.page >= result.pagination.pages} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page + 1 }); }}>Next</Button></div>}
      </section>
    </main>
  );
}
