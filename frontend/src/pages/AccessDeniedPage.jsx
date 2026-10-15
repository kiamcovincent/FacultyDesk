import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AccessDeniedPage() {
  return (
    <main className="message-page">
      <span className="message-page__icon"><ShieldAlert size={27} aria-hidden="true" /></span>
      <p className="eyebrow">403 / ACCESS DENIED</p>
      <h1>This area is restricted.</h1>
      <p>Your account does not have permission to open this page.</p>
      <Link className="text-action" to="/dashboard">Return to dashboard</Link>
    </main>
  );
}
