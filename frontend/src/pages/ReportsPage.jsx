import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import AttendanceTable from '../components/AttendanceTable.jsx';
import { API_BASE_URL, apiRequest } from '../services/api.js';

function firstOfMonth() {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [filters, setFilters] = useState({ from: firstOfMonth(), to: todayKey(), departmentId: '', subjectId: '', teacherId: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState({ from: firstOfMonth(), to: todayKey(), departmentId: '', subjectId: '', teacherId: '', status: '', page: 1 });
  const [options, setOptions] = useState({ departments: [], subjects: [], teachers: [] });
  const [report, setReport] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [optionError, setOptionError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [exportNotice, setExportNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest('/departments?active=true&limit=100'),
      apiRequest('/subjects?active=true&limit=100'),
      apiRequest('/teachers?status=active&limit=100'),
    ])
      .then(([departments, subjects, teachers]) => {
        if (active) setOptions({ departments: departments.departments, subjects: subjects.subjects, teachers: teachers.teachers });
      })
      .catch((requestError) => { if (active) setOptionError(requestError.message); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(appliedFilters.page), limit: '20' });
    for (const key of ['from', 'to', 'departmentId', 'subjectId', 'teacherId', 'status']) {
      if (appliedFilters[key]) params.set(key, appliedFilters[key]);
    }
    apiRequest(`/reports?${params}`)
      .then((data) => { if (active) setReport(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [appliedFilters, refresh]);

  function applyFilters(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setExportNotice('');
    setAppliedFilters({ ...filters, page: 1 });
  }

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  async function exportCsv() {
    setExporting(true);
    setError('');
    setExportNotice('');
    const params = new URLSearchParams({ format: 'csv' });
    for (const key of ['from', 'to', 'departmentId', 'subjectId', 'teacherId', 'status']) {
      if (appliedFilters[key]) params.set(key, appliedFilters[key]);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/reports?${params}`, { credentials: 'include' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'The report could not be exported.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facultydesk-attendance-${appliedFilters.from}-to-${appliedFilters.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setExportNotice('CSV report downloaded.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !report) return <main className="page-content"><LoadingState label="Preparing attendance report" /></main>;
  if (error && !report) return <main className="page-content"><ErrorState message={error} onRetry={retryLoad} /></main>;

  const summary = report?.summary || { total: 0, present: 0, late: 0, absent: 0, approvedLeave: 0 };
  const metrics = [
    { label: 'Records', value: summary.total, tone: 'blue' },
    { label: 'Present', value: summary.present, tone: 'green' },
    { label: 'Late', value: summary.late, tone: 'amber' },
    { label: 'Absent', value: summary.absent, tone: 'red' },
    { label: 'Approved leave', value: summary.approvedLeave, tone: 'blue' },
  ];

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h2>Attendance reports</h2></div>
      {optionError && <p className="form-alert" role="alert">Filter options could not be loaded: {optionError}</p>}
      {error && <p className="form-alert" role="alert">{error}</p>}
      {exportNotice && <p className="form-notice" role="status">{exportNotice}</p>}

      <form className="data-panel report-filter-panel" onSubmit={applyFilters}>
        <div className="data-panel__heading"><div><p className="eyebrow">FILTERS</p><h3>Choose report scope</h3></div></div>
        <div className="report-filter-grid">
          <label className="field"><span>From</span><input type="date" required value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label className="field"><span>To</span><input type="date" min={filters.from || undefined} required value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <label className="field"><span>Department</span><select disabled={loadingOptions} value={filters.departmentId} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}><option value="">All departments</option>{options.departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
          <label className="field"><span>Subject assignment</span><select disabled={loadingOptions} value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value })}><option value="">All subjects</option>{options.subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</select></label>
          <label className="field"><span>Teacher</span><select disabled={loadingOptions} value={filters.teacherId} onChange={(event) => setFilters({ ...filters, teacherId: event.target.value })}><option value="">All teachers</option>{options.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
          <label className="field"><span>Status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="approved_leave">Approved leave</option></select></label>
          <div className="report-filter-actions"><Button type="submit" variant="secondary">Apply filters</Button><Button type="button" loading={exporting} onClick={exportCsv}><Download size={16} aria-hidden="true" />Export CSV</Button></div>
        </div>
        {report?.subjectScope && <p className="report-scope-note">Subject filters include attendance for teachers assigned to that subject. Attendance records are not tied to individual class sessions.</p>}
      </form>

      <section className="metric-grid" aria-label="Attendance report summary">
        {metrics.map((metric) => <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}
      </section>

      <section className="data-panel">
        <div className="data-panel__heading"><div><p className="eyebrow">{report?.filters.from} TO {report?.filters.to}</p><h3>Attendance records</h3></div><span>{report?.pagination.total || 0} matching records</span></div>
        {loading ? <LoadingState label="Updating report" /> : report?.records.length ? <AttendanceTable records={report.records} admin /> : <EmptyState title="No matching attendance" message="Adjust the filters or date range to see other records." />}
        {report?.pagination.pages > 1 && <div className="pagination-bar"><Button variant="secondary" disabled={report.pagination.page <= 1} onClick={() => { setLoading(true); setAppliedFilters({ ...appliedFilters, page: appliedFilters.page - 1 }); }}>Previous</Button><span>Page {report.pagination.page} of {report.pagination.pages}</span><Button variant="secondary" disabled={report.pagination.page >= report.pagination.pages} onClick={() => { setLoading(true); setAppliedFilters({ ...appliedFilters, page: appliedFilters.page + 1 }); }}>Next</Button></div>}
      </section>
    </main>
  );
}
