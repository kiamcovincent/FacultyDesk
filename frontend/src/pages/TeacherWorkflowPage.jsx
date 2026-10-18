import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpenCheck, CalendarDays, Check, ClipboardCheck, UsersRound } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { apiRequest } from '../services/api.js';

const workflowSteps = [
  { id: 'registration-confirmed', label: 'Registration', title: 'Confirm registration', path: '/workflow/registration-confirmed', Icon: Check },
  { id: 'subject', label: 'Subject', title: 'Add a subject', path: '/workflow/subject', Icon: BookOpenCheck },
  { id: 'schedule', label: 'Schedule', title: 'Add a schedule', path: '/workflow/schedule', Icon: CalendarDays },
  { id: 'students', label: 'Students', title: 'Add students', path: '/workflow/students', Icon: UsersRound },
  { id: 'attendance', label: 'Attendance', title: 'Take attendance', path: '/workflow/attendance', Icon: ClipboardCheck },
];
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const statusLabels = { present: 'Present', absent: 'Absent', late: 'Late' };
const statusOptions = ['present', 'absent', 'late'];

function storageKey(userId) {
  return `facultydesk-teacher-workflow:${userId}`;
}

function readProgress(userId) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(userId)) || '{}');
  } catch {
    return {};
  }
}

function writeProgress(userId, current, updates) {
  const next = { ...current, ...updates };
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

function currentDateKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function getErrorMessage(error) {
  if (!error.details?.length) return error.message;
  return `${error.message} ${error.details.map(({ field, message }) => `${field}: ${message}`).join(' ')}`;
}

export default function TeacherWorkflowPage({ step }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(() => readProgress(user.id));
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => readProgress(user.id).subjectId || '');
  const [selectedScheduleId, setSelectedScheduleId] = useState(() => readProgress(user.id).scheduleId || '');
  const [date, setDate] = useState(() => readProgress(user.id).date || currentDateKey());
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', department: '' });
  const [scheduleForm, setScheduleForm] = useState({ className: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  const [studentForm, setStudentForm] = useState({ studentNumber: '', firstName: '', lastName: '' });
  const [departments, setDepartments] = useState([]);
  const [description, setDescription] = useState('');
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [loading, setLoading] = useState(step !== 'registration-confirmed');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [attendanceSaved, setAttendanceSaved] = useState(false);

  const activeStepIndex = workflowSteps.findIndex((item) => item.id === step);
  const blockingPath = step === 'schedule' && !progress.subjectConfirmed
    ? '/workflow/subject'
    : step === 'students' && !progress.scheduleConfirmed
      ? (progress.subjectConfirmed ? '/workflow/schedule' : '/workflow/subject')
      : step === 'attendance' && !progress.studentsConfirmed
        ? (progress.scheduleConfirmed ? '/workflow/students' : progress.subjectConfirmed ? '/workflow/schedule' : '/workflow/subject')
        : null;
  const subject = useMemo(
    () => subjects.find((item) => item._id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );
  const availableSchedules = useMemo(
    () => schedules.filter((item) => item.subject?._id === (progress.subjectId || selectedSubjectId)),
    [schedules, progress.subjectId, selectedSubjectId]
  );

  useEffect(() => {
    if (step === 'registration-confirmed' || blockingPath) return undefined;
    let active = true;
    const requests = [];
    if (step === 'subject') {
      requests.push(apiRequest('/subjects?limit=100'), apiRequest('/departments?active=true&limit=100'));
    } else if (step === 'schedule') {
      requests.push(apiRequest('/subjects?limit=100'), apiRequest('/schedules?limit=100'));
    } else if (step === 'students' && progress.subjectId) {
      requests.push(apiRequest('/students?subjectId=' + encodeURIComponent(progress.subjectId || '')));
    } else if (step === 'attendance') {
      requests.push(apiRequest('/schedules?limit=100'));
    }

    Promise.all(requests)
      .then((results) => {
        if (!active) return;
        setError('');
        if (step === 'subject') {
          setSubjects(results[0].subjects);
          setDepartments(results[1].departments);
        }
        if (step === 'schedule') {
          setSubjects(results[0].subjects);
          setSchedules(results[1].schedules);
        }
        if (step === 'students') setStudents(results[0].students);
        if (step === 'attendance') {
          setSchedules(results[0].schedules);
          const teacherSchedules = results[0].schedules.filter((item) => item.subject?._id === progress.subjectId);
          const preferred = teacherSchedules.find((item) => item._id === progress.scheduleId) || teacherSchedules[0];
          setSelectedScheduleId(preferred?._id || '');
        }
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [step, progress.subjectId, progress.scheduleId, blockingPath, refresh]);

  useEffect(() => {
    if (step !== 'attendance' || !selectedScheduleId || !date) return undefined;
    let active = true;
    apiRequest(`/class-attendance?scheduleId=${encodeURIComponent(selectedScheduleId)}&date=${encodeURIComponent(date)}`)
      .then((result) => {
        if (!active) return;
        setError('');
        setDescription(result.description || '');
        setAttendanceStudents(result.students);
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [step, selectedScheduleId, date, refresh]);

  function saveProgress(updates) {
    const next = writeProgress(user.id, progress, updates);
    setProgress(next);
  }

  function goTo(path) {
    setError('');
    setNotice('');
    setLoading(true);
    navigate(path);
  }

  async function createSubject(event) {
    event.preventDefault();
    setBusy('subject');
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/subjects', {
        method: 'POST',
        body: subjectForm,
      });
      const createdSubject = {
        ...result.subject,
        department: departments.find((item) => item._id === subjectForm.department) || null,
      };
      setSubjects((current) => [...current.filter((item) => item._id !== createdSubject._id), createdSubject]);
      setSelectedSubjectId(createdSubject._id);
      saveProgress({
        subjectId: createdSubject._id,
        subjectConfirmed: true,
        scheduleId: '',
        scheduleConfirmed: false,
        studentsConfirmed: false,
      });
      setSubjectForm({ name: '', code: '', department: '' });
      goTo('/workflow/schedule');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy('');
    }
  }

  function confirmSubject() {
    if (!selectedSubjectId) return;
    saveProgress({
      subjectId: selectedSubjectId,
      subjectConfirmed: true,
      scheduleId: '',
      scheduleConfirmed: false,
      studentsConfirmed: false,
    });
    goTo('/workflow/schedule');
  }

  async function createSchedule(event) {
    event.preventDefault();
    setBusy('schedule');
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/schedules', {
        method: 'POST',
        body: {
          subject: progress.subjectId,
          ...scheduleForm,
          dayOfWeek: Number(scheduleForm.dayOfWeek),
        },
      });
      const createdSchedule = {
        ...result.schedule,
        subject: subjects.find((item) => item._id === progress.subjectId) || { _id: progress.subjectId },
      };
      setSchedules((current) => [...current, createdSchedule]);
      setSelectedScheduleId(result.schedule._id);
      saveProgress({ scheduleId: result.schedule._id, scheduleConfirmed: true, studentsConfirmed: false });
      setScheduleForm({ className: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
      goTo('/workflow/students');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy('');
    }
  }

  function confirmSchedule() {
    if (!selectedScheduleId) return;
    saveProgress({ scheduleId: selectedScheduleId, scheduleConfirmed: true, studentsConfirmed: false });
    goTo('/workflow/students');
  }

  async function addStudent(event) {
    event.preventDefault();
    setBusy('student');
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/students', {
        method: 'POST',
        body: { ...studentForm, subjectId: progress.subjectId },
      });
      setStudentForm({ studentNumber: '', firstName: '', lastName: '' });
      setNotice(`${result.student.firstName} ${result.student.lastName} saved to ${subject?.name || 'the subject'}.`);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy('');
    }
  }

  function confirmStudents() {
    if (!students.length) return;
    saveProgress({ studentsConfirmed: true });
    goTo('/workflow/attendance');
  }

  function changeAttendance(studentId, status) {
    setAttendanceSaved(false);
    setAttendanceStudents((current) => current.map((student) => (
      student.id === studentId ? { ...student, status } : student
    )));
  }

  async function saveAttendance(event) {
    event.preventDefault();
    setBusy('attendance');
    setError('');
    setNotice('');
    try {
      await apiRequest('/class-attendance', {
        method: 'PUT',
        body: {
          scheduleId: selectedScheduleId,
          date,
          description,
          records: attendanceStudents.map((student) => ({ studentId: student.id, status: student.status })),
        },
      });
      setAttendanceSaved(true);
      saveProgress({ attendanceSaved: true });
      setNotice('Attendance saved successfully.');
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy('');
    }
  }

  if (blockingPath) return <Navigate to={blockingPath} replace />;
  if (loading && step !== 'registration-confirmed') {
    return <main className="page-content"><LoadingState label={`Loading ${workflowSteps[activeStepIndex]?.label.toLowerCase() || 'workflow'}`} /></main>;
  }
  if (error && step !== 'attendance') {
    return <main className="page-content"><ErrorState message={error} onRetry={() => setRefresh((value) => value + 1)} /></main>;
  }

  return (
    <main className="page-content teacher-workflow">
      <div className="page-heading">
        <p className="eyebrow">TEACHER SETUP / STEP {String(activeStepIndex + 1).padStart(2, '0')} OF 05</p>
        <h2>{workflowSteps[activeStepIndex]?.title}</h2>
      </div>

      <nav className="workflow-progress" aria-label="Teacher workflow progress">
        {workflowSteps.map(({ id, label, path, Icon }, index) => {
          const complete = id === 'registration-confirmed'
            || (id === 'subject' && progress.subjectConfirmed)
            || (id === 'schedule' && progress.scheduleConfirmed)
            || (id === 'students' && progress.studentsConfirmed)
            || (id === 'attendance' && progress.attendanceSaved);
          return (
          <span className={`workflow-progress__step${index === activeStepIndex ? ' is-current' : ''}${complete ? ' is-complete' : ''}`} key={id}>
            <span className="workflow-progress__mark">{complete ? <Check size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}</span>
            <span className="workflow-progress__label">{label}</span>
            {index < workflowSteps.length - 1 && <span className="workflow-progress__line" aria-hidden="true" />}
            {complete && index < activeStepIndex && <Link className="workflow-progress__link" to={path} aria-label={`Return to ${label}`} />}
          </span>
          );
        })}
      </nav>

      {error && <p className="form-alert" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {step === 'registration-confirmed' && (
        <section className="workflow-panel workflow-confirmation" aria-labelledby="registration-confirmed-title">
          <span className="workflow-confirmation__icon"><Check size={22} aria-hidden="true" /></span>
          <p className="eyebrow">ACCOUNT READY</p>
          <h3 id="registration-confirmed-title">Registration confirmed</h3>
          <p>Your teacher account is signed in as <strong>{user.name}</strong> ({user.email}). Your profile is linked to your authenticated account.</p>
          <Button onClick={() => goTo('/workflow/subject')}>Continue to subject setup <ArrowRight size={17} aria-hidden="true" /></Button>
        </section>
      )}

      {step === 'subject' && (
        <div className="workflow-grid">
          <section className="workflow-panel">
            <div className="data-panel__heading"><div><p className="eyebrow">EXISTING RECORDS</p><h3>Choose a subject</h3></div></div>
            {subjects.length ? (
              <>
                <label className="field"><span>My subjects</span><select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}><option value="">Select a subject</option>{subjects.filter((item) => item.active).map((item) => <option value={item._id} key={item._id}>{item.name} ({item.code}) · {item.department?.name || 'No department'}</option>)}</select></label>
                <Button onClick={confirmSubject} disabled={!selectedSubjectId}>Confirm Subject</Button>
              </>
            ) : <EmptyState title="No subjects yet" message="Create a subject, then confirm it to continue." />}
          </section>

          <form className="workflow-panel workflow-form" onSubmit={createSubject}>
            <div className="data-panel__heading"><div><p className="eyebrow">NEW RECORD</p><h3>Add a subject</h3></div><BookOpenCheck size={18} aria-hidden="true" /></div>
            <label className="field"><span>Subject name</span><input required minLength={2} maxLength={120} value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} /></label>
            <label className="field"><span>Subject code</span><input required minLength={2} maxLength={20} pattern="[A-Za-z0-9-]+" value={subjectForm.code} onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Department</span><select required value={subjectForm.department} onChange={(event) => setSubjectForm({ ...subjectForm, department: event.target.value })}><option value="">Select department</option>{departments.map((department) => <option value={department._id} key={department._id}>{department.name} ({department.code})</option>)}</select></label>
            {!departments.length && <p className="workflow-help" role="status">No departments are available. Ask an administrator to add a department before creating a subject.</p>}
            <Button type="submit" loading={busy === 'subject'} disabled={!departments.length}>Add Subject</Button>
          </form>
        </div>
      )}

      {step === 'schedule' && (
        <div className="workflow-grid">
          <section className="workflow-panel">
            <div className="data-panel__heading"><div><p className="eyebrow">CONFIRMED SUBJECT</p><h3>{subject?.name || 'Selected subject'}</h3></div></div>
            <p className="workflow-help">{subject?.code} · {subject?.department?.name || 'No department assigned'}</p>
            {availableSchedules.length > 0 && (
              <>
                <label className="field"><span>Existing schedule</span><select value={selectedScheduleId} onChange={(event) => setSelectedScheduleId(event.target.value)}><option value="">Select a class schedule</option>{availableSchedules.map((item) => <option value={item._id} key={item._id}>{item.className} · {item.subject?.department?.name || 'No department'} · {weekdays[item.dayOfWeek]} · {item.startTime}–{item.endTime}</option>)}</select></label>
                <Button variant="secondary" onClick={confirmSchedule} disabled={!selectedScheduleId}>Confirm Schedule</Button>
              </>
            )}
          </section>

          <form className="workflow-panel workflow-form" onSubmit={createSchedule}>
            <div className="data-panel__heading"><div><p className="eyebrow">NEW RECORD</p><h3>Add a schedule</h3></div><CalendarDays size={18} aria-hidden="true" /></div>
            <label className="field"><span>Class or section</span><input required minLength={1} maxLength={100} value={scheduleForm.className} onChange={(event) => setScheduleForm({ ...scheduleForm, className: event.target.value })} /></label>
            <label className="field"><span>Day</span><select value={scheduleForm.dayOfWeek} onChange={(event) => setScheduleForm({ ...scheduleForm, dayOfWeek: event.target.value })}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <div className="academic-time-fields"><label className="field"><span>Starts</span><input type="time" required value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} /></label><label className="field"><span>Ends</span><input type="time" required value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} /></label></div>
            <label className="field"><span>Time zone</span><input required maxLength={100} value={scheduleForm.timeZone} onChange={(event) => setScheduleForm({ ...scheduleForm, timeZone: event.target.value })} /></label>
            <Button type="submit" loading={busy === 'schedule'} disabled={!progress.subjectId}>Add Schedule</Button>
          </form>
        </div>
      )}

      {step === 'students' && (
        <div className="workflow-grid">
          <form className="workflow-panel workflow-form" onSubmit={addStudent}>
            <div className="data-panel__heading"><div><p className="eyebrow">{subject?.name || 'SELECTED SUBJECT'}</p><h3>Add a student</h3></div><UsersRound size={18} aria-hidden="true" /></div>
            <label className="field"><span>Student number</span><input required minLength={1} maxLength={40} pattern="[A-Za-z0-9_-]+" value={studentForm.studentNumber} onChange={(event) => setStudentForm({ ...studentForm, studentNumber: event.target.value })} /></label>
            <label className="field"><span>First name</span><input required minLength={1} maxLength={80} value={studentForm.firstName} onChange={(event) => setStudentForm({ ...studentForm, firstName: event.target.value })} /></label>
            <label className="field"><span>Last name</span><input required minLength={1} maxLength={80} value={studentForm.lastName} onChange={(event) => setStudentForm({ ...studentForm, lastName: event.target.value })} /></label>
            <Button type="submit" loading={busy === 'student'}>Save Student</Button>
          </form>

          <section className="workflow-panel">
            <div className="data-panel__heading"><div><p className="eyebrow">SAVED ROSTER</p><h3>{students.length} students</h3></div></div>
            {students.length ? <><div className="workflow-roster">{students.map((item) => <div className="workflow-roster__row" key={item._id}><span className="workflow-roster__initial">{item.firstName[0]}{item.lastName[0]}</span><span><strong>{item.firstName} {item.lastName}</strong><small>{item.studentNumber}</small></span></div>)}</div><Button onClick={confirmStudents}>Continue to attendance <ArrowRight size={17} aria-hidden="true" /></Button></> : <EmptyState title="No students in this subject" message="Add and save at least one student before continuing to attendance." />}
          </section>
        </div>
      )}

      {step === 'attendance' && (
        <section className="workflow-panel workflow-attendance">
          <div className="workflow-attendance__toolbar">
              <label className="field"><span>Class schedule</span><select value={selectedScheduleId} onChange={(event) => { setLoading(true); setAttendanceSaved(false); setSelectedScheduleId(event.target.value); }}><option value="">Select a schedule</option>{availableSchedules.map((item) => <option value={item._id} key={item._id}>{item.className} · {item.subject?.department?.name || 'No department'} · {item.subject?.name} · {weekdays[item.dayOfWeek]}</option>)}</select></label>
              <label className="field"><span>Attendance date</span><input type="date" required value={date} onChange={(event) => { setLoading(true); setAttendanceSaved(false); setDate(event.target.value); saveProgress({ date: event.target.value }); }} /></label>
          </div>
          <label className="field workflow-description"><span>Attendance Description</span><textarea disabled={!selectedScheduleId} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a note about this class session" /></label>
          {loading ? <LoadingState label="Loading saved class attendance" /> : error ? <ErrorState message={error} onRetry={() => setRefresh((value) => value + 1)} /> : attendanceStudents.length ? (
            <form onSubmit={saveAttendance}>
              <div className="workflow-attendance__list">
                {attendanceStudents.map((student) => (
                  <div className="workflow-attendance__row" key={student.id}>
                    <span className="workflow-roster__initial">{student.firstName[0]}{student.lastName[0]}</span>
                    <span className="workflow-attendance__student"><strong>{student.firstName} {student.lastName}</strong><small>{student.studentNumber}</small></span>
                    <div className="workflow-status-controls" role="group" aria-label={`Attendance status for ${student.firstName} ${student.lastName}`}>
                      {statusOptions.map((status) => <button type="button" key={status} className={`workflow-status workflow-status--${status}${student.status === status ? ' is-selected' : ''}`} aria-pressed={student.status === status} onClick={() => changeAttendance(student.id, status)}>{statusLabels[status]}</button>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="workflow-attendance__footer">
                <span>{attendanceStudents.filter((student) => student.status).length} of {attendanceStudents.length} marked</span>
                <Button type="submit" loading={busy === 'attendance'} disabled={!selectedScheduleId || attendanceStudents.some((student) => !student.status)}>Save Attendance</Button>
              </div>
              {attendanceSaved && <p className="workflow-saved" role="status"><Check size={17} aria-hidden="true" />Saved attendance reloaded from the server.</p>}
            </form>
          ) : selectedScheduleId
            ? <EmptyState title="No students to mark" message="Add students to this subject and confirm the roster before taking attendance." />
            : <EmptyState title="No class schedule selected" message="Create or select a class schedule before taking attendance." />}
        </section>
      )}

      {activeStepIndex > 0 && (
        <div className="workflow-back"><Button variant="secondary" onClick={() => navigate(workflowSteps[activeStepIndex - 1].path)}><ArrowLeft size={15} aria-hidden="true" />Previous step</Button></div>
      )}
    </main>
  );
}