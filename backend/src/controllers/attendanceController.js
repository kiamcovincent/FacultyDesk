const attendanceService = require('../services/attendanceService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const checkIn = handleAsync(async (req, res) => {
  const record = await attendanceService.checkIn(req.user._id);
  res.status(201).json({ message: 'Check-in recorded.', record });
});

const checkOut = handleAsync(async (req, res) => {
  const record = await attendanceService.checkOut(req.user._id);
  res.status(200).json({ message: 'Check-out recorded.', record });
});

const myHistory = handleAsync(async (req, res) => {
  const result = await attendanceService.getMyHistory(req.user._id, req.query);
  res.status(200).json(result);
});

const listAttendance = handleAsync(async (req, res) => {
  const result = await attendanceService.listAttendance(req.query);
  res.status(200).json(result);
});

module.exports = { checkIn, checkOut, myHistory, listAttendance };
