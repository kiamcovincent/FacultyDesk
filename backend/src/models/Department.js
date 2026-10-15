const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ name: 1 }, { unique: true });
departmentSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);
