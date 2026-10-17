import { useEffect, useState } from 'react';
import { BookOpenCheck, CalendarDays, Plus, RotateCcw } from 'lucide-react';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { apiRequest } from '../services/api.js';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const initialDepartment = { name: '', code: '' };
const initialSubject = { name: '', code: '', department: '', teachers: [] };
const initialSchedule = { teacher: '', subject: '', className: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:00', timeZone: 'UTC' };

function toLocalTime(value) {
  if (!value) return 'Not set';
  return value;
}

export default function AcademicManagementPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState({ departments: [], subjects: [], schedules: [], teachers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [departmentForm, setDepartmentForm] = useState(initialDepartment);
  const [subjectForm, setSubjectForm] = useState(initialSubject);
  const [scheduleForm, setScheduleForm] = useState(initialSchedule);

  useEffect(() => {
    let active = true;
    const requests = [
      apiRequest('/departments?active=true&limit=100'),
      apiRequest('/subjects?limit=100'),
      apiRequest('/schedules?limit=100'),
    ];
    if (isAdmin) requests.push(apiRequest('/teachers?status=active&limit=100'));

    Promise.all(requests)
      .then(([departments, subjects, schedules, teachers]) => {
        if (active) {
          setData({
            departments: departments.departments,
            subjects: subjects.subjects,
            schedules: schedules.schedules,
            teachers: teachers?.teachers || [],
          });
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [isAdmin, refresh]);

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  function refreshAfterMutation(message) {
    setNotice(message);
    setActionError('');
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  async function createDepartment(event) {
    event.preventDefault();
    setBusy('department');
    setActionError('');
    try {
      await apiRequest('/departments', { method: 'POST', body: departmentForm });
      setDepartmentForm(initialDepartment);
      refreshAfterMutation('Department created.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function createSubject(event) {
    event.preventDefault();
    setBusy('subject');
    setActionError('');
    try {
      await apiRequest('/subjects', { method: 'POST', body: subjectForm });
      setSubjectForm(initialSubject);
      refreshAfterMutation('Subject created and teachers assigned.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function createSchedule(event) {
    event.preventDefault();
    setBusy('schedule');
    setActionError('');
    try {
      await apiRequest('/schedules', {
        method: 'POST',
        body: {
          ...scheduleForm,
          ...(isAdmin ? {} : { teacher: undefined }),
          dayOfWeek: Number(scheduleForm.dayOfWeek),
        },
      });
      setScheduleForm(initialSchedule);
      refreshAfterMutation('Schedule saved and subject assignment updated.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function toggleDepartment(department) {
    setBusy(department._id);
    setActionError('');
    try {
      await apiRequest(`/departments/${department._id}/status`, {
        method: 'PATCH',
        body: { active: !department.active },
      });
      refreshAfterMutation(`Department ${department.active ? 'deactivated' : 'activated'}.`);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function toggleSubject(subject) {
    setBusy(subject._id);
    setActionError('');
    try {
      await apiRequest(`/subjects/${subject._id}`, {
        method: 'PATCH',
        body: { active: !subject.active },
      });
      refreshAfterMutation(`Subject ${subject.active ? 'deactivated' : 'activated'}.`);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function toggleSchedule(schedule) {
    setBusy(schedule._id);
    setActionError('');
    try {
      await apiRequest(`/schedules/${schedule._id}`, {
        method: 'PATCH',
        body: { active: !schedule.active },
      });
      refreshAfterMutation(`Schedule ${schedule.active ? 'deactivated' : 'activated'}.`);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) return <main className="page-content"><LoadingState label="Loading subjects and schedules" /></main>;
  if (error) return <main className="page-content"><ErrorState message={error} onRetry={retryLoad} /></main>;

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">{isAdmin ? 'ADMINISTRATION' : 'TEACHING WORKSPACE'}</p><h2>{isAdmin ? 'Subjects & schedules' : 'My classes'}</h2></div>
      {actionError && <p className="form-alert" role="alert">{actionError}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {isAdmin && (
        <>
          <section className="academic-forms">
            <form className="data-panel academic-form" onSubmit={createDepartment}>
              <div className="data-panel__heading"><div><h3>Departments</h3><p>Set the department before adding its subjects.</p></div><Plus size={18} aria-hidden="true" /></div>
              <label className="field"><span>Department name</span><input required minLength={2} maxLength={100} value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} /></label>
              <label className="field"><span>Code</span><input required minLength={2} maxLength={20} value={departmentForm.code} onChange={(event) => setDepartmentForm({ ...departmentForm, code: event.target.value.toUpperCase() })} /></label>
              <Button type="submit" loading={busy === 'department'}>Add department</Button>
            </form>
          </section>

          <section className="data-panel">
            <div className="data-panel__heading"><h3>Departments</h3></div>
            {data.departments.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Code</th><th>Status</th><th /></tr></thead><tbody>{data.departments.map((department) => <tr key={department._id}><td>{department.name}</td><td>{department.code}</td><td><span className={`record-status record-status--${department.active ? 'active' : 'inactive'}`}>{department.active ? 'Active' : 'Inactive'}</span></td><td><Button variant="secondary" disabled={busy === department._id} onClick={() => toggleDepartment(department)}>{department.active ? 'Deactivate' : 'Activate'}</Button></td></tr>)}</tbody></table></div> : <EmptyState title="No departments" message="Add a department before creating a subject." />}
          </section>
        </>
      )}

      <section className="academic-forms">
        <form className="data-panel academic-form" onSubmit={createSubject}>
          <div className="data-panel__heading"><div><h3>Add a subject</h3><p>{isAdmin ? 'Assign the subject to one or more teachers.' : 'Create a subject for your teaching profile.'}</p></div><BookOpenCheck size={18} aria-hidden="true" /></div>
          <label className="field"><span>Subject name</span><input required minLength={2} maxLength={120} value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} /></label>
          <label className="field"><span>Subject code</span><input required minLength={2} maxLength={20} value={subjectForm.code} onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value.toUpperCase() })} /></label>
          {isAdmin && <label className="field"><span>Department</span><select required value={subjectForm.department} onChange={(event) => setSubjectForm({ ...subjectForm, department: event.target.value })}><option value="">Select department</option>{data.departments.filter((department) => department.active).map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>}
          {isAdmin && <label className="field"><span>Assigned teachers</span><select multiple value={subjectForm.teachers} onChange={(event) => setSubjectForm({ ...subjectForm, teachers: [...event.target.selectedOptions].map((option) => option.value) })}>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>}
          <Button type="submit" loading={busy === 'subject'} disabled={isAdmin && !data.departments.some((department) => department.active)}>Save subject</Button>
        </form>

        <form className="data-panel academic-form" onSubmit={createSchedule}>
          <div className="data-panel__heading"><div><h3>Add a schedule</h3><p>Conflicting teacher times are rejected.</p></div><CalendarDays size={18} aria-hidden="true" /></div>
          {isAdmin && <label className="field"><span>Teacher</span><select required value={scheduleForm.teacher} onChange={(event) => setScheduleForm({ ...scheduleForm, teacher: event.target.value })}><option value="">Select teacher</option>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>}
          <label className="field"><span>Subject</span><select required value={scheduleForm.subject} onChange={(event) => setScheduleForm({ ...scheduleForm, subject: event.target.value })}><option value="">Select subject</option>{data.subjects.filter((subject) => subject.active).map((subject) => <option key={subject._id} value={subject._id}>{subject.name} ({subject.code})</option>)}</select></label>
          <label className="field"><span>Class</span><input required maxLength={100} value={scheduleForm.className} onChange={(event) => setScheduleForm({ ...scheduleForm, className: event.target.value })} /></label>
          <label className="field"><span>Day</span><select value={scheduleForm.dayOfWeek} onChange={(event) => setScheduleForm({ ...scheduleForm, dayOfWeek: event.target.value })}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
          <div className="academic-time-fields"><label className="field"><span>Starts</span><input type="time" required value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} /></label><label className="field"><span>Ends</span><input type="time" required value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} /></label></div>
          <label className="field"><span>Time zone</span><input required value={scheduleForm.timeZone} onChange={(event) => setScheduleForm({ ...scheduleForm, timeZone: event.target.value })} /></label>
          <Button type="submit" loading={busy === 'schedule'} disabled={!data.subjects.some((subject) => subject.active) || (isAdmin && !data.teachers.length)}>Save schedule</Button>
        </form>
      </section>

      <section className="data-panel">
        <div className="data-panel__heading"><div><p className="eyebrow">CURRICULUM</p><h3>{isAdmin ? 'Subjects' : 'Assigned subjects'}</h3></div><span>{data.subjects.length} subjects</span></div>
        {data.subjects.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Subject</th><th>Code</th><th>Department</th>{isAdmin && <th>Teachers</th>}{isAdmin && <th>Status</th>}{isAdmin && <th />}</tr></thead><tbody>{data.subjects.map((subject) => <tr key={subject._id}><td>{subject.name}</td><td>{subject.code}</td><td>{subject.department?.name || '—'}</td>{isAdmin && <td>{subject.teachers?.map((teacher) => teacher.name).join(', ') || 'Unassigned'}</td>}{isAdmin && <td><span className={`record-status record-status--${subject.active ? 'active' : 'inactive'}`}>{subject.active ? 'Active' : 'Inactive'}</span></td>}{isAdmin && <td><Button variant="secondary" disabled={busy === subject._id} onClick={() => toggleSubject(subject)}>{subject.active ? 'Deactivate' : 'Activate'}</Button></td>}</tr>)}</tbody></table></div> : <EmptyState title="No subjects yet" message={isAdmin ? 'Add a department and then create a subject above.' : 'Subjects assigned to you will appear here.'} />}
      </section>

      <section className="data-panel">
        <div className="data-panel__heading"><div><p className="eyebrow">TIMETABLE</p><h3>{isAdmin ? 'Class schedules' : 'My schedule'}</h3></div><span>{data.schedules.length} classes</span></div>
        {data.schedules.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{isAdmin && <th>Teacher</th>}<th>Day</th><th>Time</th><th>Class</th><th>Subject</th><th>Time zone</th>{isAdmin && <th />}</tr></thead><tbody>{data.schedules.map((schedule) => <tr key={schedule._id}>{isAdmin && <td>{schedule.teacher?.name || 'Teacher'}</td>}<td>{weekdays[schedule.dayOfWeek]}</td><td>{toLocalTime(schedule.startTime)}–{toLocalTime(schedule.endTime)}</td><td>{schedule.className}</td><td>{schedule.subject?.name || 'Subject'}</td><td>{schedule.timeZone}</td>{isAdmin && <td><Button variant="secondary" disabled={busy === schedule._id} onClick={() => toggleSchedule(schedule)}>{schedule.active ? 'Deactivate' : 'Activate'}</Button></td>}</tr>)}</tbody></table></div> : <EmptyState title="No schedules yet" message={isAdmin ? 'Create a subject and assign a class schedule above.' : 'Your assigned class times will appear here.'} />}
      </section>

      <div className="academic-refresh"><Button variant="secondary" onClick={retryLoad}><RotateCcw size={15} aria-hidden="true" />Refresh academic records</Button></div>
    </main>
  );
}
