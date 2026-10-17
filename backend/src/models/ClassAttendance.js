const mongoose = require('mongoose');

const classAttendanceSchema = new mongoose.Schema(
  {
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    records: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
        status: { type: String, enum: ['present', 'absent', 'late'], required: true },
      },
    ],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

classAttendanceSchema.index(
  { schedule: 1, date: 1 },
  { unique: true, name: 'unique_schedule_attendance_date' }
);

module.exports = mongoose.models.ClassAttendance || mongoose.model('ClassAttendance', classAttendanceSchema);