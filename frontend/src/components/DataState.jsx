import { AlertCircle, LoaderCircle } from 'lucide-react';
import Button from './Button.jsx';

export function LoadingState({ label = 'Loading records' }) {
  return (
    <div className="data-state" role="status" aria-live="polite">
      <LoaderCircle className="fd-button__spinner" size={21} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="data-state data-state--error" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function EmptyState({ title, message }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
