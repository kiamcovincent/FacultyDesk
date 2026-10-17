const classroomService = require('../services/classroomService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const listStudents = handleAsync(async (req, res) => {
  res.status(200).json(await classroomService.listStudents(req.user, req.query.subjectId));
});

const addStudent = handleAsync(async (req, res) => {
  const result = await classroomService.addStudent(req.user, req.body);
  res.status(201).json(result);
});

const getClassAttendance = handleAsync(async (req, res) => {
  res.status(200).json(await classroomService.getClassAttendance(
    req.user,
    req.query.scheduleId,
    req.query.date
  ));
});

const saveClassAttendance = handleAsync(async (req, res) => {
  res.status(200).json(await classroomService.saveClassAttendance(req.user, req.body));
});

module.exports = { addStudent, getClassAttendance, listStudents, saveClassAttendance };