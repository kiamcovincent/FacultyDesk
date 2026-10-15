const AuditLog = require('../models/AuditLog');
const Attendance = require('../models/Attendance');
const CorrectionRequest = require('../models/CorrectionRequest');
const LeaveRequest = require('../models/LeaveRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const attendanceService = require('./attendanceService');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit };
}

async function writeAudit(actor, action, entityType, entity, changes, ipAddress) {
  return AuditLog.create({ actor, action, entityType, entityId: entity._id, changes, ipAddress });
}

async function notifyAdmins(title, message) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  if (admins.length) {
    await Notification.insertMany(admins.map((admin) => ({ user: admin._id, title, message })));
  }
}

async function notifyTeacher(teacherId, title, message) {
  await Notification.create({ user: teacherId, title, message });
}

function overlapDateFilter(startDate, endDate) {
  return {
    startDate: { $lte: new Date(`${endDate}T23:59:59.999Z`) },
    endDate: { $gte: new Date(`${startDate}T00:00:00.000Z`) },
  };
}

async function createLeaveRequest(user, input) {
  const dates = overlapDateFilter(input.startDate, input.endDate);
  const existing = await LeaveRequest.exists({
    teacher: user._id,
    status: { $in: ['pending', 'approved'] },
    ...dates,
  });
  if (existing) throw httpError(409, 'LEAVE_REQUEST_OVERLAP', 'You already have a pending or approved request covering these dates.');

  const leaveRequest = await LeaveRequest.create({
    teacher: user._id,
    startDate: input.startDate,
    endDate: input.endDate,
    reason: input.reason,
  });
  await notifyAdmins('Leave request submitted', `${user.name} submitted a leave request for ${input.startDate}.`);
  return leaveRequest;
}

async function listLeaveRequests(user, query) {
  const { page, limit } = pagination(query);
  const filter = user.role === 'admin' ? {} : { teacher: user._id };
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.startDate = {};
    if (query.to) filter.startDate.$lte = new Date(`${query.to}T23:59:59.999Z`);
    if (query.from) filter.endDate = { $gte: new Date(`${query.from}T00:00:00.000Z`) };
  }
  const [requests, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate('teacher', 'name email')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LeaveRequest.countDocuments(filter),
  ]);
  return { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

function schoolDateKeys(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const finalDate = new Date(`${endDate.toISOString().slice(0, 10)}T00:00:00.000Z`);

  while (cursor <= finalDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

async function approveLeaveAttendance(leaveRequest, adminId) {
  const dates = schoolDateKeys(leaveRequest.startDate, leaveRequest.endDate);
  const operations = dates.map((date) => ({
    updateOne: {
      filter: { teacher: leaveRequest.teacher, date },
      update: {
        $setOnInsert: {
          teacher: leaveRequest.teacher,
          date,
          checkIn: null,
          checkOut: null,
          status: 'approved_leave',
          source: 'admin',
          updatedBy: adminId,
          notes: 'Approved leave',
        },
      },
      upsert: true,
    },
  }));

  await Attendance.bulkWrite(operations, { ordered: false });
}

async function reviewLeaveRequest(requestId, admin, input, ipAddress) {
  const leaveRequest = await LeaveRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    {
      $set: {
        status: input.status,
        reviewedBy: admin._id,
        reviewedAt: new Date(),
        reviewerNote: input.reviewerNote || '',
      },
    },
    { new: true, runValidators: true }
  );
  if (!leaveRequest) throw httpError(404, 'PENDING_LEAVE_NOT_FOUND', 'Pending leave request not found.');

  if (input.status === 'approved') await approveLeaveAttendance(leaveRequest, admin._id);
  await writeAudit(admin._id, `leave_request.${input.status}`, 'LeaveRequest', leaveRequest, {
    status: input.status,
    reviewerNote: leaveRequest.reviewerNote,
  }, ipAddress);
  await notifyTeacher(
    leaveRequest.teacher,
    `Leave request ${input.status}`,
    `Your leave request was ${input.status}.${leaveRequest.reviewerNote ? ` Note: ${leaveRequest.reviewerNote}` : ''}`
  );
  return leaveRequest;
}

async function createCorrectionRequest(user, input) {
  const attendance = await Attendance.findOne({ _id: input.attendance, teacher: user._id });
  if (!attendance) throw httpError(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found.');
  if (input.requestedCheckIn === undefined && input.requestedCheckOut === undefined) {
    throw httpError(400, 'CORRECTION_VALUE_REQUIRED', 'Provide a corrected check-in or check-out time.');
  }

  const requestedCheckIn = input.requestedCheckIn ?? attendance.checkIn;
  const requestedCheckOut = input.requestedCheckOut ?? attendance.checkOut;
  if (requestedCheckIn && requestedCheckOut && new Date(requestedCheckOut) <= new Date(requestedCheckIn)) {
    throw httpError(400, 'INVALID_CORRECTION_TIME', 'Check-out must be later than check-in.');
  }
  if (requestedCheckIn) {
    await attendanceService.calculateCorrectedStatus(user._id, attendance.date, requestedCheckIn);
  }

  const pending = await CorrectionRequest.exists({ attendance: attendance._id, status: 'pending' });
  if (pending) throw httpError(409, 'CORRECTION_ALREADY_PENDING', 'A correction request is already pending for this attendance record.');

  const correctionRequest = await CorrectionRequest.create({
    teacher: user._id,
    attendance: attendance._id,
    requestedCheckIn: input.requestedCheckIn || null,
    requestedCheckOut: input.requestedCheckOut || null,
    reason: input.reason,
  });
  await notifyAdmins('Attendance correction submitted', `${user.name} requested an attendance correction for ${attendance.date}.`);
  return correctionRequest;
}

async function listCorrectionRequests(user, query) {
  const { page, limit } = pagination(query);
  const filter = user.role === 'admin' ? {} : { teacher: user._id };
  if (query.status) filter.status = query.status;
  if (query.teacherId && user.role === 'admin') filter.teacher = query.teacherId;
  const [requests, total] = await Promise.all([
    CorrectionRequest.find(filter)
      .populate('teacher', 'name email')
      .populate('attendance', 'date checkIn checkOut status')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CorrectionRequest.countDocuments(filter),
  ]);
  return { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function reviewCorrectionRequest(requestId, admin, input, ipAddress) {
  const correctionRequest = await CorrectionRequest.findOne({ _id: requestId, status: 'pending' });
  if (!correctionRequest) throw httpError(404, 'PENDING_CORRECTION_NOT_FOUND', 'Pending correction request not found.');
  const attendance = await Attendance.findOne({ _id: correctionRequest.attendance, teacher: correctionRequest.teacher });
  if (!attendance) throw httpError(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record no longer exists.');
  let auditChanges = null;

  if (input.status === 'approved') {
    const checkIn = correctionRequest.requestedCheckIn || attendance.checkIn;
    const checkOut = correctionRequest.requestedCheckOut || attendance.checkOut;
    if (checkIn && checkOut && checkOut <= checkIn) {
      throw httpError(409, 'INVALID_CORRECTION_TIME', 'The corrected check-out must be later than check-in.');
    }

    const before = { checkIn: attendance.checkIn, checkOut: attendance.checkOut, status: attendance.status };
    attendance.checkIn = checkIn;
    attendance.checkOut = checkOut;
    attendance.status = await attendanceService.calculateCorrectedStatus(attendance.teacher, attendance.date, checkIn);
    attendance.updatedBy = admin._id;
    attendance.notes = [attendance.notes, 'Attendance correction approved'].filter(Boolean).join(' | ');
    await attendance.save();
    auditChanges = { before, after: { checkIn, checkOut, status: attendance.status } };
  }

  correctionRequest.status = input.status;
  correctionRequest.reviewedBy = admin._id;
  correctionRequest.reviewedAt = new Date();
  correctionRequest.reviewerNote = input.reviewerNote || '';
  await correctionRequest.save();

  await writeAudit(admin._id, `correction_request.${input.status}`, 'CorrectionRequest', correctionRequest, {
    status: input.status,
    attendance: attendance._id,
    ...(auditChanges || {}),
    reviewerNote: correctionRequest.reviewerNote,
  }, ipAddress);
  await notifyTeacher(
    correctionRequest.teacher,
    `Attendance correction ${input.status}`,
    `Your attendance correction request was ${input.status}.${correctionRequest.reviewerNote ? ` Note: ${correctionRequest.reviewerNote}` : ''}`
  );
  return correctionRequest;
}

async function listNotifications(user, query) {
  const { page, limit } = pagination(query);
  const filter = { user: user._id };
  if (query.unread === true || query.unread === 'true') filter.readAt = null;
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);
  return { notifications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function markNotificationRead(notificationId, userId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw httpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  return notification;
}

module.exports = {
  createCorrectionRequest,
  createLeaveRequest,
  listCorrectionRequests,
  listLeaveRequests,
  listNotifications,
  markNotificationRead,
  reviewCorrectionRequest,
  reviewLeaveRequest,
};
