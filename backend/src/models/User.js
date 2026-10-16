const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    supabaseUserId: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ['teacher', 'admin'],
      default: 'teacher',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index(
  { supabaseUserId: 1 },
  { unique: true, sparse: true, name: 'unique_supabase_user_id' }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.set('toJSON', {
  transform(document, result) {
    delete result.passwordHash;
    delete result.supabaseUserId;
    delete result.__v;
    return result;
  },
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
