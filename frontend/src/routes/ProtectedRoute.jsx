import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

function AuthLoading() {
  return (
    <main className="auth-loading" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      <span>Checking your session</span>
    </main>
  );
}

export function RequireAuth() {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <Outlet />;
}

export function RequireRole({ role }) {
  const { user } = useAuth();
  return user?.role === role ? <Outlet /> : <Navigate to="/access-denied" replace />;
}
