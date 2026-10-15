const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    entityType: { type: String, required: true, trim: true, maxlength: 100 },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    changes: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, trim: true, maxlength: 64, default: '' },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
