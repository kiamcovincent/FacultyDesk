const attendanceService = require('../services/attendanceService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const getDashboard = handleAsync(async (req, res) => {
  const data = await attendanceService.getDashboard(req.user);
  res.status(200).json(data);
});

module.exports = { getDashboard };
