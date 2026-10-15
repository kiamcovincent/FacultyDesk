import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function LoginPage() {
  const { user, status, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'loading') return <main className="auth-loading" role="status">Checking your session</main>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const signedInUser = await login(form);
      const fallback = signedInUser.role === 'admin' ? '/admin/dashboard' : '/dashboard';
      navigate(location.state?.from?.pathname || fallback, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-labelledby="login-heading">
        <div className="brand brand--large">
          <span className="brand__mark"><BookOpenCheck size={24} aria-hidden="true" /></span>
          <span className="brand__copy"><strong>FacultyDesk</strong><small>ACADEMIC OPERATIONS</small></span>
        </div>
        <div className="auth-story__content">
          <span className="auth-kicker">A clearer school day</span>
          <h1 id="login-heading">Attendance, with the whole picture in view.</h1>
          <p>One dependable workspace for teachers and school administrators.</p>
        </div>
        <div className="auth-story__foot"><span>TEACHER ATTENDANCE MANAGEMENT</span><span>01 / 04</span></div>
      </section>

      <section className="auth-form-panel" aria-labelledby="signin-title">
        <div className="auth-form-panel__inner">
          <p className="eyebrow">WELCOME BACK</p>
          <h2 id="signin-title">Sign in to FacultyDesk</h2>
          <p className="form-intro">Use your school account to continue.</p>
          <form className="form-stack" onSubmit={handleSubmit} noValidate>
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
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            {error && <p className="form-alert" role="alert">{error}</p>}
            <Button type="submit" loading={loading} className="form-submit">
              <span>{loading ? 'Signing in' : 'Sign in'}</span>
              {!loading && <ArrowRight size={17} aria-hidden="true" />}
            </Button>
          </form>
          <p className="auth-switch">New to FacultyDesk? <Link to="/register">Create a teacher account</Link></p>
        </div>
      </section>
    </main>
  );
}
