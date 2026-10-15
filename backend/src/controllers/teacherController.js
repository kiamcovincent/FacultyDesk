const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function teacherFields(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    department: user.department,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit };
}

const listTeachers = handleAsync(async (req, res) => {
  const { page, limit } = pagination(req.query);
  const filter = { role: 'teacher' };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.department) filter.department = req.query.department;
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('_id name email role status department createdAt updatedAt')
      .populate('department', 'name code')
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return res.status(200).json({
    teachers: users.map(teacherFields),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const createTeacher = handleAsync(async (req, res) => {
  const { name, email, password, department } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({
      name,
      email,
      passwordHash,
      department: department || null,
      role: 'teacher',
      status: 'active',
    });
    return res.status(201).json({ teacher: teacherFields(user) });
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    throw error;
  }
});

const updateTeacher = handleAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.teacherId)) {
    throw httpError(404, 'TEACHER_NOT_FOUND', 'Teacher not found.');
  }

  const updates = {};
  for (const field of ['name', 'email', 'department']) {
    if (Object.hasOwn(req.body, field)) updates[field] = req.body[field] || null;
  }

  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.teacherId, role: 'teacher' },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('_id name email role status department createdAt updatedAt');

    if (!user) throw httpError(404, 'TEACHER_NOT_FOUND', 'Teacher not found.');
    return res.status(200).json({ teacher: teacherFields(user) });
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    throw error;
  }
});

const updateTeacherStatus = handleAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.teacherId)) {
    throw httpError(404, 'TEACHER_NOT_FOUND', 'Teacher not found.');
  }

  const user = await User.findOneAndUpdate(
    { _id: req.params.teacherId, role: 'teacher' },
    { $set: { status: req.body.status } },
    { new: true, runValidators: true }
  ).select('_id name email role status department createdAt updatedAt');

  if (!user) throw httpError(404, 'TEACHER_NOT_FOUND', 'Teacher not found.');
  return res.status(200).json({ teacher: teacherFields(user) });
});

module.exports = { listTeachers, createTeacher, updateTeacher, updateTeacherStatus };
