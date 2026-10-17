const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    studentNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    firstName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

studentSchema.index({ studentNumber: 1 }, { unique: true, name: 'unique_student_number' });
studentSchema.index({ subjects: 1, active: 1 });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);