const auditLogService = require('../services/auditLogService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const listAuditLogs = handleAsync(async (req, res) => {
  const result = await auditLogService.getAuditLogs(req.query);
  res.status(200).json(result);
});

module.exports = { listAuditLogs };
