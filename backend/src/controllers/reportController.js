const AuditLog = require('../models/AuditLog');
const reportService = require('../services/reportService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const getReport = handleAsync(async (req, res) => {
  const exportCsv = req.query.format === 'csv';
  const report = await reportService.getReport(req.query, exportCsv);

  if (exportCsv) {
    await AuditLog.create({
      actor: req.user._id,
      action: 'attendance_report.exported',
      entityType: 'AttendanceReport',
      changes: { filters: report.filters, total: report.summary.total },
      ipAddress: req.ip,
    });
    res.status(200);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="facultydesk-attendance-${report.filters.from}-to-${report.filters.to}.csv"`);
    return res.send(report.csv);
  }

  return res.status(200).json(report);
});

module.exports = { getReport };
