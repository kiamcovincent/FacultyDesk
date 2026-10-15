import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { apiRequest } from '../services/api.js';

function changeSummary(changes) {
  if (!changes) return '—';
  const text = JSON.stringify(changes);
  return text.length > 150 ? `${text.slice(0, 147)}…` : text;
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState({ action: '', entityType: '', actorId: '', from: '', to: '' });
  const [applied, setApplied] = useState({ action: '', entityType: '', actorId: '', from: '', to: '', page: 1 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(applied.page), limit: '20' });
    for (const key of ['action', 'entityType', 'actorId', 'from', 'to']) {
      if (applied[key]) params.set(key, applied[key]);
    }
    apiRequest(`/audit-logs?${params}`)
      .then((data) => { if (active) setResult(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied, refresh]);

  function applyFilters(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setApplied({ ...filters, page: 1 });
  }

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h2>Audit logs</h2></div>
      <form className="data-panel audit-filter-panel" onSubmit={applyFilters}>
        <div className="data-panel__heading"><div><p className="eyebrow">TRACEABILITY</p><h3>Filter activity</h3></div><Filter size={18} aria-hidden="true" /></div>
        <div className="audit-filter-grid">
          <label className="field"><span>Action</span><input value={filters.action} placeholder="e.g. settings.updated" onChange={(event) => setFilters({ ...filters, action: event.target.value })} /></label>
          <label className="field"><span>Entity type</span><input value={filters.entityType} placeholder="e.g. Attendance" onChange={(event) => setFilters({ ...filters, entityType: event.target.value })} /></label>
          <label className="field"><span>Actor ID</span><input value={filters.actorId} placeholder="MongoDB user ID" onChange={(event) => setFilters({ ...filters, actorId: event.target.value })} /></label>
          <label className="field"><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label className="field"><span>To</span><input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <Button type="submit" variant="secondary">Apply filters</Button>
        </div>
      </form>

      <section className="data-panel">
        <div className="data-panel__heading"><h3>Administrative activity</h3>{result && <span>{result.pagination.total} entries</span>}</div>
        {loading ? <LoadingState label="Loading audit records" /> : error ? <ErrorState message={error} onRetry={retryLoad} /> : result.logs.length === 0 ? <EmptyState title="No audit entries" message="Administrative changes and report exports will appear here." /> : (
          <div className="table-scroll"><table className="data-table audit-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Changes</th><th>IP address</th></tr></thead><tbody>{result.logs.map((log) => <tr key={log._id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.actor?.name || 'Unknown'}<small>{log.actor?.email}</small></td><td>{log.action}</td><td>{log.entityType}</td><td title={JSON.stringify(log.changes)}>{changeSummary(log.changes)}</td><td>{log.ipAddress || '—'}</td></tr>)}</tbody></table></div>
        )}
        {result?.pagination.pages > 1 && <div className="pagination-bar"><Button variant="secondary" disabled={applied.page <= 1} onClick={() => { setLoading(true); setApplied({ ...applied, page: applied.page - 1 }); }}>Previous</Button><span>Page {result.pagination.page} of {result.pagination.pages}</span><Button variant="secondary" disabled={applied.page >= result.pagination.pages} onClick={() => { setLoading(true); setApplied({ ...applied, page: applied.page + 1 }); }}>Next</Button></div>}
      </section>
    </main>
  );
}
