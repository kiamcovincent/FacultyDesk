const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subjectSchema.index({ department: 1, code: 1 }, { unique: true });

module.exports = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
