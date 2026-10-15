const mongoose = require('mongoose');
const requestService = require('../services/requestService');

function handleAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validId(param, code, next) {
  if (mongoose.isValidObjectId(param)) return true;
  const error = new Error('The requested record was not found.');
  error.statusCode = 404;
  error.code = code;
  next(error);
  return false;
}

const createLeave = handleAsync(async (req, res) => {
  const request = await requestService.createLeaveRequest(req.user, req.body);
  res.status(201).json({ request });
});

const listLeave = handleAsync(async (req, res) => {
  res.status(200).json(await requestService.listLeaveRequests(req.user, req.query));
});

const reviewLeave = handleAsync(async (req, res, next) => {
  if (!validId(req.params.requestId, 'LEAVE_REQUEST_NOT_FOUND', next)) return;
  const request = await requestService.reviewLeaveRequest(req.params.requestId, req.user, req.body, req.ip);
  res.status(200).json({ request });
});

const createCorrection = handleAsync(async (req, res) => {
  const request = await requestService.createCorrectionRequest(req.user, req.body);
  res.status(201).json({ request });
});

const listCorrections = handleAsync(async (req, res) => {
  res.status(200).json(await requestService.listCorrectionRequests(req.user, req.query));
});

const reviewCorrection = handleAsync(async (req, res, next) => {
  if (!validId(req.params.requestId, 'CORRECTION_REQUEST_NOT_FOUND', next)) return;
  const request = await requestService.reviewCorrectionRequest(req.params.requestId, req.user, req.body, req.ip);
  res.status(200).json({ request });
});

const listNotifications = handleAsync(async (req, res) => {
  res.status(200).json(await requestService.listNotifications(req.user, req.query));
});

const markNotificationRead = handleAsync(async (req, res, next) => {
  if (!validId(req.params.notificationId, 'NOTIFICATION_NOT_FOUND', next)) return;
  const notification = await requestService.markNotificationRead(req.params.notificationId, req.user._id);
  res.status(200).json({ notification });
});

module.exports = {
  createCorrection,
  createLeave,
  listCorrections,
  listLeave,
  listNotifications,
  markNotificationRead,
  reviewCorrection,
  reviewLeave,
};
