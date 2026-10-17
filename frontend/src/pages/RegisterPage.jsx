import { ArrowRight, BookOpenCheck, MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { apiRequest } from '../services/api.js';

export default function RegisterPage() {
  const { user, status, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', departmentId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/departments/available')
      .then((data) => { if (active) setDepartments(data.departments); })
      .catch((requestError) => { if (active) setDepartmentsError(requestError.message); })
      .finally(() => { if (active) setDepartmentsLoading(false); });
    return () => { active = false; };
  }, []);

  if (status === 'loading') return <main className="auth-loading" role="status">Checking your session</main>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const outcome = await register(form);
      if (outcome.pendingConfirmation) {
        setConfirmationEmail(outcome.email);
        setForm({ name: '', email: '', password: '', departmentId: '' });
        return;
      }

      navigate('/workflow/registration-confirmed', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-labelledby="register-heading">
        <div className="brand brand--large">
          <span className="brand__mark"><BookOpenCheck size={24} aria-hidden="true" /></span>
          <span className="brand__copy"><strong>FacultyDesk</strong><small>ACADEMIC OPERATIONS</small></span>
        </div>
        <div className="auth-story__content">
          <span className="auth-kicker">A considered start</span>
          <h1 id="register-heading">Set up your teacher workspace.</h1>
          <p>Create your account first. Your teaching setup follows after registration.</p>
        </div>
        <div className="auth-story__foot"><span>TEACHER ATTENDANCE MANAGEMENT</span><span>01 / 04</span></div>
      </section>

      <section className="auth-form-panel" aria-labelledby="create-account-title">
        <div className="auth-form-panel__inner">
          <p className="eyebrow">TEACHER REGISTRATION</p>
          {confirmationEmail ? (
            <div className="registration-confirmation" role="status" aria-live="polite">
              <span className="registration-confirmation__icon"><MailCheck size={22} aria-hidden="true" /></span>
              <h2 id="create-account-title">Check your email</h2>
              <p>
                A confirmation link was sent to <strong>{confirmationEmail}</strong>. Confirm your email
                before signing in.
              </p>
              <Link className="text-action" to="/login?next=/workflow/registration-confirmed">Return to sign in</Link>
            </div>
          ) : (
            <>
              <h2 id="create-account-title">Create your account</h2>
              <p className="form-intro">Use your school email address to get started.</p>
              <form className="form-stack" onSubmit={handleSubmit}>
                <label className="field">
                  <span>Full name</span>
                  <input
                    type="text"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Email address</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Department <small>Optional</small></span>
                  <select
                    disabled={departmentsLoading || departments.length === 0}
                    value={form.departmentId}
                    onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                  >
                    <option value="">{departmentsLoading ? 'Loading departments' : 'No selection'}</option>
                    {departments.map((department) => (
                      <option value={department._id} key={department._id}>
                        {department.name} ({department.code})
                      </option>
                    ))}
                  </select>
                </label>
                {departmentsError && <p className="form-intro" role="status">Department options are unavailable. You can continue without selecting one.</p>}
                {!departmentsLoading && !departmentsError && departments.length === 0 && (
                  <p className="form-intro" role="status">No department options are available. You can continue without one.</p>
                )}
                <label className="field">
                  <span>Password <small>At least 8 characters</small></span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                  />
                </label>
                {error && <p className="form-alert" role="alert">{error}</p>}
                <Button type="submit" loading={loading} className="form-submit">
                  <span>{loading ? 'Creating account' : 'Create teacher account'}</span>
                  {!loading && <ArrowRight size={17} aria-hidden="true" />}
                </Button>
              </form>
              <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
