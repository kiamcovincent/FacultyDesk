const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const Department = require('../models/Department');
const Schedule = require('../models/Schedule');
const Subject = require('../models/Subject');
const User = require('../models/User');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function pageOptions(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit };
}

async function audit(actor, action, entityType, entity, changes, ipAddress = '') {
  await AuditLog.create({
    actor,
    action,
    entityType,
    entityId: entity?._id || null,
    changes,
    ipAddress,
  });
}

async function getDepartments(query = {}) {
  const { page, limit } = pageOptions(query);
  const filter = {};
  if (query.active !== undefined) filter.active = query.active === 'true';
  if (query.search) filter.name = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [departments, total] = await Promise.all([
    Department.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);
  return { departments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function createDepartment(input, actor, ipAddress) {
  try {
    const department = await Department.create({ name: input.name, code: input.code });
    await audit(actor, 'department.created', 'Department', department, { name: department.name, code: department.code }, ipAddress);
    return department;
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'DEPARTMENT_EXISTS', 'A department with this name or code already exists.');
    throw error;
  }
}

async function setDepartmentStatus(departmentId, active, actor, ipAddress) {
  const department = await Department.findByIdAndUpdate(
    departmentId,
    { $set: { active } },
    { new: true, runValidators: true }
  );
  if (!department) throw httpError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  await audit(actor, active ? 'department.activated' : 'department.deactivated', 'Department', department, { active }, ipAddress);
  return department;
}

async function getSubjects(query, user) {
  const { page, limit } = pageOptions(query);
  const filter = {};
  if (user.role === 'teacher') {
    filter.teachers = user._id;
    filter.active = true;
  } else {
    if (query.department) filter.department = query.department;
    if (query.active !== undefined) filter.active = query.active === 'true';
    if (query.teacherId) filter.teachers = query.teacherId;
  }
  if (query.search) {
    const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: expression }, { code: expression }];
  }

  const [subjects, total] = await Promise.all([
    Subject.find(filter)
      .populate('department', 'name code')
      .populate('teachers', 'name email status')
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Subject.countDocuments(filter),
  ]);
  return { subjects, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function assertDepartment(departmentId) {
  if (!mongoose.isValidObjectId(departmentId)) throw httpError(400, 'INVALID_DEPARTMENT', 'Select a valid department.');
  const department = await Department.findOne({ _id: departmentId, active: true });
  if (!department) throw httpError(404, 'DEPARTMENT_NOT_FOUND', 'Active department not found.');
  return department;
}

async function assertTeachers(teacherIds = []) {
  const uniqueIds = [...new Set(teacherIds.map((id) => id.toString()))];
  if (!uniqueIds.every(mongoose.isValidObjectId)) throw httpError(400, 'INVALID_TEACHER', 'Select valid teacher accounts.');
  if (!uniqueIds.length) return [];
  const teachers = await User.find({ _id: { $in: uniqueIds }, role: 'teacher', status: 'active' }).select('_id');
  if (teachers.length !== uniqueIds.length) throw httpError(400, 'INVALID_TEACHER', 'All assigned accounts must be active teachers.');
  return teachers.map((teacher) => teacher._id);
}

async function createSubject(input, actor, ipAddress) {
  await assertDepartment(input.department);
  const teachers = await assertTeachers(input.teachers || []);
  try {
    const subject = await Subject.create({ ...input, teachers });
    await audit(actor, 'subject.created', 'Subject', subject, { name: subject.name, code: subject.code, department: subject.department, teachers }, ipAddress);
    return subject;
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'SUBJECT_CODE_EXISTS', 'That subject code already exists in this department.');
    throw error;
  }
}

async function updateSubject(subjectId, updates, actor, ipAddress) {
  if (updates.department) await assertDepartment(updates.department);
  if (updates.teachers) updates.teachers = await assertTeachers(updates.teachers);
  const subject = await Subject.findByIdAndUpdate(subjectId, { $set: updates }, { new: true, runValidators: true });
  if (!subject) throw httpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');
  await audit(actor, 'subject.updated', 'Subject', subject, updates, ipAddress);
  return subject;
}

async function getSchedules(query, user) {
  const { page, limit } = pageOptions(query);
  const filter = {};
  if (user.role === 'teacher') {
    filter.teacher = user._id;
    filter.active = true;
  }
  else if (query.teacherId) filter.teacher = query.teacherId;
  if (query.subjectId) filter.subject = query.subjectId;
  if (query.dayOfWeek !== undefined) filter.dayOfWeek = Number(query.dayOfWeek);
  if (query.active !== undefined) filter.active = query.active === 'true';

  const [schedules, total] = await Promise.all([
    Schedule.find(filter)
      .populate('teacher', 'name email status')
      .populate({ path: 'subject', select: 'name code department', populate: { path: 'department', select: 'name code' } })
      .sort({ dayOfWeek: 1, startTime: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Schedule.countDocuments(filter),
  ]);
  return { schedules, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function assertNoScheduleOverlap({ teacher, dayOfWeek, startTime, endTime }, excludeId) {
  const filter = {
    teacher,
    dayOfWeek,
    active: true,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const overlap = await Schedule.exists(filter);
  if (overlap) throw httpError(409, 'SCHEDULE_OVERLAP', 'This teacher already has a class scheduled during that time.');
}

async function createSchedule(input, actor, ipAddress) {
  const [teacher, subject] = await Promise.all([
    User.findOne({ _id: input.teacher, role: 'teacher', status: 'active' }).select('_id'),
    Subject.findOne({ _id: input.subject, active: true }),
  ]);
  if (!teacher) throw httpError(404, 'TEACHER_NOT_FOUND', 'Active teacher not found.');
  if (!subject) throw httpError(404, 'SUBJECT_NOT_FOUND', 'Active subject not found.');
  await assertNoScheduleOverlap(input);
  const schedule = await Schedule.create(input);
  await Subject.updateOne({ _id: subject._id }, { $addToSet: { teachers: teacher._id } });
  await audit(actor, 'schedule.created', 'Schedule', schedule, input, ipAddress);
  return schedule;
}

async function updateSchedule(scheduleId, updates, actor, ipAddress) {
  const existing = await Schedule.findById(scheduleId);
  if (!existing) throw httpError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found.');
  const next = { ...existing.toObject(), ...updates };
  if (updates.teacher) {
    const teacher = await User.findOne({ _id: updates.teacher, role: 'teacher', status: 'active' }).select('_id');
    if (!teacher) throw httpError(404, 'TEACHER_NOT_FOUND', 'Active teacher not found.');
  }
  if (updates.subject) {
    const subject = await Subject.findOne({ _id: updates.subject, active: true }).select('_id');
    if (!subject) throw httpError(404, 'SUBJECT_NOT_FOUND', 'Active subject not found.');
  }
  if (next.active) await assertNoScheduleOverlap(next, existing._id);
  Object.assign(existing, updates);
  await existing.save();
  await audit(actor, 'schedule.updated', 'Schedule', existing, updates, ipAddress);
  return existing;
}

module.exports = {
  createDepartment,
  createSchedule,
  createSubject,
  getDepartments,
  getSchedules,
  getSubjects,
  setDepartmentStatus,
  updateSchedule,
  updateSubject,
};
