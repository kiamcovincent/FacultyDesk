const mongoose = require('mongoose');

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const scheduleSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    className: { type: String, required: true, trim: true, maxlength: 100 },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: timePattern },
    endTime: { type: String, required: true, match: timePattern },
    timeZone: { type: String, required: true, default: 'UTC' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, autoIndex: false }
);

scheduleSchema.path('endTime').validate(function validateEndTime(value) {
  return !this.startTime || value > this.startTime;
}, 'Schedule end time must be later than its start time.');

scheduleSchema.index(
  { teacher: 1, dayOfWeek: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: 'active_teacher_schedule_slot_unique',
  }
);

module.exports = mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
