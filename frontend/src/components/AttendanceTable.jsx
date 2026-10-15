const statusLabels = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  approved_leave: 'Approved leave',
};

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function AttendanceTable({ records, admin = false }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {admin && <th>Teacher</th>}
            <th>Date</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record._id || record.id}>
              {admin && <td>{record.teacher?.name || 'Teacher'}</td>}
              <td>{record.date}</td>
              <td>{formatTime(record.checkIn)}</td>
              <td>{formatTime(record.checkOut)}</td>
              <td><span className={`record-status record-status--${record.status}`}>{statusLabels[record.status] || record.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
