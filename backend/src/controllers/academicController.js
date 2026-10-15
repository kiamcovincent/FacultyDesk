const mongoose = require('mongoose');
const academicService = require('../services/academicService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validateObjectId(id, resource, next) {
  if (mongoose.isValidObjectId(id)) return true;
  const error = new Error(`${resource} not found.`);
  error.statusCode = 404;
  error.code = `${resource.toUpperCase()}_NOT_FOUND`;
  next(error);
  return false;
}

const listDepartments = handleAsync(async (req, res) => {
  res.status(200).json(await academicService.getDepartments(req.query));
});

const createDepartment = handleAsync(async (req, res) => {
  const department = await academicService.createDepartment(req.body, req.user._id, req.ip);
  res.status(201).json({ department });
});

const updateDepartmentStatus = handleAsync(async (req, res, next) => {
  if (!validateObjectId(req.params.departmentId, 'department', next)) return;
  const department = await academicService.setDepartmentStatus(
    req.params.departmentId,
    req.body.active,
    req.user._id,
    req.ip
  );
  res.status(200).json({ department });
});

const listSubjects = handleAsync(async (req, res) => {
  res.status(200).json(await academicService.getSubjects(req.query, req.user));
});

const createSubject = handleAsync(async (req, res) => {
  const subject = await academicService.createSubject(req.body, req.user._id, req.ip);
  res.status(201).json({ subject });
});

const updateSubject = handleAsync(async (req, res, next) => {
  if (!validateObjectId(req.params.subjectId, 'subject', next)) return;
  const subject = await academicService.updateSubject(req.params.subjectId, req.body, req.user._id, req.ip);
  res.status(200).json({ subject });
});

const listSchedules = handleAsync(async (req, res) => {
  res.status(200).json(await academicService.getSchedules(req.query, req.user));
});

const createSchedule = handleAsync(async (req, res) => {
  const schedule = await academicService.createSchedule(req.body, req.user._id, req.ip);
  res.status(201).json({ schedule });
});

const updateSchedule = handleAsync(async (req, res, next) => {
  if (!validateObjectId(req.params.scheduleId, 'schedule', next)) return;
  const schedule = await academicService.updateSchedule(req.params.scheduleId, req.body, req.user._id, req.ip);
  res.status(200).json({ schedule });
});

module.exports = {
  createDepartment,
  createSchedule,
  createSubject,
  listDepartments,
  listSchedules,
  listSubjects,
  updateDepartmentStatus,
  updateSchedule,
  updateSubject,
};
