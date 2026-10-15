import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import AttendanceTable from '../components/AttendanceTable.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { apiRequest } from '../services/api.js';

export default function HistoryPage() {
  const [filter, setFilter] = useState({ from: '', to: '' });
  const [query, setQuery] = useState({ from: '', to: '', page: 1 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(query.page), limit: '10' });
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    apiRequest(`/attendance/my-history?${params}`)
      .then((data) => { if (active) setResult(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, refresh]);

  function submitFilter(event) {
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
      <div className="page-heading"><p className="eyebrow">PERSONAL RECORDS</p><h2>My attendance history</h2></div>
      <form className="filter-bar" onSubmit={submitFilter}>
        <label className="field"><span>From</span><input type="date" value={filter.from} onChange={(event) => setFilter({ ...filter, from: event.target.value })} /></label>
        <label className="field"><span>To</span><input type="date" value={filter.to} onChange={(event) => setFilter({ ...filter, to: event.target.value })} /></label>
        <Button type="submit" variant="secondary">Apply dates</Button>
      </form>
      <section className="data-panel">
        <div className="data-panel__heading"><h3>Attendance records</h3>{result && <span>{result.pagination.total} records</span>}</div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={retryLoad} /> : result.records.length === 0 ? <EmptyState title="No attendance records" message="Records matching this date range will appear here." /> : <AttendanceTable records={result.records} />}
        {result?.pagination.pages > 1 && (
          <div className="pagination-bar">
            <Button variant="secondary" disabled={query.page <= 1} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page - 1 }); }}>Previous</Button>
            <span>Page {result.pagination.page} of {result.pagination.pages}</span>
            <Button variant="secondary" disabled={query.page >= result.pagination.pages} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page + 1 }); }}>Next</Button>
          </div>
        )}
      </section>
    </main>
  );
}
