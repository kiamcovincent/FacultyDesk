import { ClipboardList } from 'lucide-react';

export default function WorkspacePage({ title }) {
  return (
    <section className="page-content">
      <div className="page-heading">
        <p className="eyebrow">FACULTYDESK WORKSPACE</p>
        <h2>{title}</h2>
      </div>
      <div className="empty-state">
        <span className="empty-state__icon"><ClipboardList size={23} aria-hidden="true" /></span>
        <h3>{title} will appear here</h3>
        <p>This view is being connected to the FacultyDesk API in the MVP pages phase.</p>
      </div>
    </section>
  );
}
