const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: {
      type: String,
      enum: ['present', 'late', 'absent', 'approved_leave'],
      required: true,
    },
    source: { type: String, enum: ['web', 'admin', 'system'], default: 'web' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

attendanceSchema.path('checkOut').validate(function validateCheckOut(value) {
  return !value || !this.checkIn || value > this.checkIn;
}, 'Check-out must be later than check-in.');

attendanceSchema.index({ teacher: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1, status: 1 });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
