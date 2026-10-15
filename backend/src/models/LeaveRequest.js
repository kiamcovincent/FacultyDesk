const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewerNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

leaveRequestSchema.path('endDate').validate(function validateEndDate(value) {
  return !this.startDate || value >= this.startDate;
}, 'Leave end date must be on or after its start date.');

leaveRequestSchema.index({ teacher: 1, status: 1, startDate: -1 });

module.exports = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);
