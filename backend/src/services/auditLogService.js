const AuditLog = require('../models/AuditLog');

function pageOptions(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit };
}

async function getAuditLogs(query) {
  const { page, limit } = pageOptions(query);
  const filter = {};
  if (query.actorId) filter.actor = query.actorId;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.action) filter.action = { $regex: query.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name email role')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { getAuditLogs };
