import { CircleHelp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="message-page">
      <span className="message-page__icon"><CircleHelp size={27} aria-hidden="true" /></span>
      <p className="eyebrow">404 / NOT FOUND</p>
      <h1>We couldn’t find that page.</h1>
      <p>The address may be out of date or the page may have moved.</p>
      <Link className="text-action" to="/dashboard">Return to dashboard</Link>
    </main>
  );
}
