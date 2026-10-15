import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, UserRound } from 'lucide-react';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { apiRequest } from '../services/api.js';

const emptyTeacher = { name: '', email: '', password: '' };

export default function TeacherManagementPage() {
  const [teachers, setTeachers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyTeacher);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: '10', status });
    if (search) params.set('search', search);
    apiRequest(`/teachers?${params}`)
      .then((data) => { if (active) { setTeachers(data.teachers); setPagination(data.pagination); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, refresh, search, status]);

  async function createTeacher(event) {
    event.preventDefault();
    setActionError('');
    setNotice('');
    try {
      await apiRequest('/teachers', { method: 'POST', body: form });
      setForm(emptyTeacher);
      setNotice('Teacher account created.');
      setLoading(true);
      setError('');
      setStatus('active');
      setSearch('');
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    }
  }

  async function updateTeacher(teacherId) {
    setBusyId(teacherId);
    setActionError('');
    try {
      await apiRequest(`/teachers/${teacherId}`, { method: 'PATCH', body: editForm });
      setEditingId('');
      setNotice('Teacher details updated.');
      setLoading(true);
      setError('');
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  async function changeStatus(teacher) {
    const nextStatus = teacher.status === 'active' ? 'inactive' : 'active';
    setBusyId(teacher.id);
    setActionError('');
    try {
      await apiRequest(`/teachers/${teacher.id}/status`, { method: 'PATCH', body: { status: nextStatus } });
      setNotice(`Teacher ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`);
      setLoading(true);
      setError('');
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  function applySearch(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSearch(searchInput.trim());
    setPage(1);
  }

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h2>Teacher management</h2></div>
      <section className="data-panel create-panel">
        <div className="data-panel__heading"><div><h3>Add a teacher</h3><p>Create a teacher account with a temporary password.</p></div><UserRound size={20} aria-hidden="true" /></div>
        <form className="teacher-create-form" onSubmit={createTeacher}>
          <label className="field"><span>Full name</span><input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="field"><span>Temporary password</span><input type="password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <Button type="submit"><Plus size={16} aria-hidden="true" />Create teacher</Button>
        </form>
        {actionError && <p className="form-alert" role="alert">{actionError}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
      </section>

      <section className="data-panel management-panel">
        <div className="data-panel__heading"><h3>Teacher accounts</h3>{pagination && <span>{pagination.total} accounts</span>}</div>
        <form className="filter-bar filter-bar--compact" onSubmit={applySearch}>
          <label className="field"><span>Search teachers</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name or email" /></label>
          <label className="field"><span>Account status</span><select value={status} onChange={(event) => { setLoading(true); setError(''); setStatus(event.target.value); setPage(1); }}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        {loading ? <LoadingState label="Loading teacher accounts" /> : error ? <ErrorState message={error} onRetry={retryLoad} /> : teachers.length === 0 ? <EmptyState title="No teachers found" message="Try a different search or create a teacher account above." /> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Teacher</th><th>Email</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>{editingId === teacher.id ? <input aria-label="Teacher name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /> : teacher.name}</td>
                <td>{editingId === teacher.id ? <input aria-label="Teacher email" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /> : teacher.email}</td>
                <td>{teacher.department?.name || '—'}</td>
                <td><span className={`record-status record-status--${teacher.status}`}>{teacher.status}</span></td>
                <td className="table-actions">
                  {editingId === teacher.id ? <Button variant="icon" aria-label="Save teacher" loading={busyId === teacher.id} onClick={() => updateTeacher(teacher.id)}><Check size={17} aria-hidden="true" /></Button> : <Button variant="icon" aria-label={`Edit ${teacher.name}`} onClick={() => { setEditingId(teacher.id); setEditForm({ name: teacher.name, email: teacher.email }); }}><Pencil size={17} aria-hidden="true" /></Button>}
                  <Button variant="secondary" disabled={busyId === teacher.id} onClick={() => changeStatus(teacher)}>{teacher.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                </td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {pagination?.pages > 1 && <div className="pagination-bar"><Button variant="secondary" disabled={page <= 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Previous</Button><span>Page {page} of {pagination.pages}</span><Button variant="secondary" disabled={page >= pagination.pages} onClick={() => { setLoading(true); setPage(page + 1); }}>Next</Button></div>}
      </section>
    </main>
  );
}
