const mongoose = require('mongoose');

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    schoolName: { type: String, required: true, trim: true, maxlength: 160, default: 'FacultyDesk' },
    workStartTime: { type: String, required: true, match: timePattern, default: '08:00' },
    workEndTime: { type: String, required: true, match: timePattern, default: '16:00' },
    gracePeriodMinutes: { type: Number, required: true, min: 0, max: 240, default: 10 },
    timeZone: { type: String, required: true, default: 'UTC' },
  },
  { timestamps: true }
);

settingsSchema.path('workEndTime').validate(function validateWorkEnd(value) {
  return !this.workStartTime || value > this.workStartTime;
}, 'Work end time must be later than work start time.');

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
