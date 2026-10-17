const mongoose = require('mongoose');

const registrationIntentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    supabaseUserId: { type: String },
    status: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending', required: true },
  },
  { timestamps: true }
);

registrationIntentSchema.index(
  { supabaseUserId: 1 },
  { unique: true, sparse: true, name: 'unique_registration_supabase_user_id' }
);

module.exports = mongoose.models.RegistrationIntent
  || mongoose.model('RegistrationIntent', registrationIntentSchema);