const mongoose = require('mongoose');

const correctionRequestSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
    requestedCheckIn: { type: Date, default: null },
    requestedCheckOut: { type: Date, default: null },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewerNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

correctionRequestSchema.index({ teacher: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.CorrectionRequest || mongoose.model('CorrectionRequest', correctionRequestSchema);
