const Attendance = require('../models/Attendance');
const CorrectionRequest = require('../models/CorrectionRequest');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { getCurrentSettings } = require('./settingsService');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function minutesFromTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function localDateTime(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function calculateStatus({
  checkInMinute,
  currentMinute,
  workStartTime,
  workEndTime,
  gracePeriodMinutes,
  approvedLeave = false,
}) {
  if (approvedLeave) return 'approved_leave';

  const workEndMinute = minutesFromTime(workEndTime);

  if (checkInMinute === null || checkInMinute === undefined) {
    return currentMinute >= workEndMinute ? 'absent' : null;
  }

  const onTimeThrough = minutesFromTime(workStartTime) + gracePeriodMinutes;
  return checkInMinute <= onTimeThrough ? 'present' : 'late';
}

async function calculateCorrectedStatus(teacherId, attendanceDate, checkIn) {
  if (!checkIn) {
    const error = new Error('A valid check-in is required to approve this correction.');
    error.statusCode = 400;
    error.code = 'CHECK_IN_REQUIRED';
    throw error;
  }

  const settings = await getSettings();
  const clock = localDateTime(new Date(checkIn), settings.timeZone);
  if (clock.date !== attendanceDate) {
    const error = new Error('Corrected check-in must remain on the attendance date.');
    error.statusCode = 400;
    error.code = 'CHECK_IN_DATE_MISMATCH';
    throw error;
  }
  const approvedLeave = await findApprovedLeave(teacherId, attendanceDate);

  return calculateStatus({
    checkInMinute: clock.minutes,
    currentMinute: clock.minutes,
    workStartTime: settings.workStartTime,
    workEndTime: settings.workEndTime,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    approvedLeave: Boolean(approvedLeave),
  });
}

async function getSettings() {
  return getCurrentSettings();
}

function utcDayBounds(dateKey) {
  return {
    start: new Date(`${dateKey}T00:00:00.000Z`),
    end: new Date(`${dateKey}T23:59:59.999Z`),
  };
}

async function findApprovedLeave(teacherId, dateKey) {
  const bounds = utcDayBounds(dateKey);
  return LeaveRequest.exists({
    teacher: teacherId,
    status: 'approved',
    startDate: { $lte: bounds.end },
    endDate: { $gte: bounds.start },
  });
}

async function markAbsenteesForToday(settings, now = new Date()) {
  const clock = localDateTime(now, settings.timeZone);
  const workEndMinute = minutesFromTime(settings.workEndTime);

  if (clock.minutes < workEndMinute) return 0;

  const bounds = utcDayBounds(clock.date);
  const [teachers, approvedLeaves] = await Promise.all([
    User.find({ role: 'teacher', status: 'active' }).select('_id').lean(),
    LeaveRequest.find({
      status: 'approved',
      startDate: { $lte: bounds.end },
      endDate: { $gte: bounds.start },
    }).select('teacher').lean(),
  ]);
  const leaveTeacherIds = new Set(approvedLeaves.map((leave) => leave.teacher.toString()));
  const operations = teachers.map((teacher) => ({
    updateOne: {
      filter: { teacher: teacher._id, date: clock.date },
      update: {
        $setOnInsert: {
          teacher: teacher._id,
          date: clock.date,
          checkIn: null,
          checkOut: null,
          status: leaveTeacherIds.has(teacher._id.toString()) ? 'approved_leave' : 'absent',
          source: 'system',
          notes: '',
        },
      },
      upsert: true,
    },
  }));

  if (!operations.length) return 0;

  try {
    const result = await Attendance.bulkWrite(operations, { ordered: false });
    return result.upsertedCount || 0;
  } catch (error) {
    if (error.code === 11000) return 0;
    throw error;
  }
}

async function checkIn(teacherId, now = new Date()) {
  const settings = await getSettings();
  const clock = localDateTime(now, settings.timeZone);
  const approvedLeave = await findApprovedLeave(teacherId, clock.date);

  if (approvedLeave) {
    throw httpError(409, 'APPROVED_LEAVE', 'Attendance cannot be checked in during approved leave.');
  }

  if (clock.minutes >= minutesFromTime(settings.workEndTime)) {
    await markAbsenteesForToday(settings, now);
    throw httpError(409, 'CHECK_IN_CLOSED', 'The attendance check-in window has closed for today.');
  }

  const status = calculateStatus({
    checkInMinute: clock.minutes,
    currentMinute: clock.minutes,
    workStartTime: settings.workStartTime,
    workEndTime: settings.workEndTime,
    gracePeriodMinutes: settings.gracePeriodMinutes,
  });

  try {
    return await Attendance.create({
      teacher: teacherId,
      date: clock.date,
      checkIn: now,
      status,
      source: 'web',
    });
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, 'DUPLICATE_CHECK_IN', 'An attendance record already exists for today.');
    }
    throw error;
  }
}

async function checkOut(teacherId, now = new Date()) {
  const settings = await getSettings();
  const { date } = localDateTime(now, settings.timeZone);
  const attendance = await Attendance.findOneAndUpdate(
    { teacher: teacherId, date, checkIn: { $ne: null }, checkOut: null },
    { $set: { checkOut: now } },
    { new: true, runValidators: true }
  );

  if (attendance) return attendance;

  const existing = await Attendance.findOne({ teacher: teacherId, date });

  if (!existing || !existing.checkIn) {
    throw httpError(409, 'CHECK_IN_REQUIRED', 'A successful check-in is required before checking out.');
  }

  throw httpError(409, 'DUPLICATE_CHECK_OUT', 'You have already checked out for today.');
}

function pageOptions(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const sortFields = new Set(['date', 'checkIn', 'createdAt']);
  const sortBy = sortFields.has(query.sortBy) ? query.sortBy : 'date';
  const direction = query.order === 'asc' ? 1 : -1;

  return { page, limit, sort: { [sortBy]: direction, _id: direction } };
}

function dateFilters(query) {
  if (query.date) return { date: query.date };

  const filter = {};
  if (query.from) filter.date = { ...filter.date, $gte: query.from };
  if (query.to) filter.date = { ...filter.date, $lte: query.to };
  return filter;
}

async function getMyHistory(teacherId, query) {
  const { page, limit, sort } = pageOptions(query);
  const filter = { teacher: teacherId, ...dateFilters(query) };
  const [records, total] = await Promise.all([
    Attendance.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Attendance.countDocuments(filter),
  ]);

  return { records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function listAttendance(query) {
  const settings = await getSettings();
  const today = localDateTime(new Date(), settings.timeZone).date;

  if (!query.date || query.date === today) {
    await markAbsenteesForToday(settings);
  }

  const { page, limit, sort } = pageOptions(query);
  const filter = dateFilters(query);
  if (query.teacherId) filter.teacher = query.teacherId;
  if (query.status) filter.status = query.status;

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('teacher', 'name email department')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  return { records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getSchoolDate(now = new Date()) {
  const settings = await getSettings();
  return localDateTime(now, settings.timeZone).date;
}

async function ensureTodayRecords(now = new Date()) {
  const settings = await getSettings();
  return markAbsenteesForToday(settings, now);
}

async function getDashboard(user, now = new Date()) {
  const settings = await getSettings();
  const clock = localDateTime(now, settings.timeZone);

  if (user.role === 'admin') {
    await markAbsenteesForToday(settings, now);
    const [totalTeachers, present, late, absent, approvedLeave, pendingLeaves, pendingCorrections, recentAttendance] = await Promise.all([
      User.countDocuments({ role: 'teacher', status: 'active' }),
      Attendance.countDocuments({ date: clock.date, status: 'present' }),
      Attendance.countDocuments({ date: clock.date, status: 'late' }),
      Attendance.countDocuments({ date: clock.date, status: 'absent' }),
      Attendance.countDocuments({ date: clock.date, status: 'approved_leave' }),
      LeaveRequest.countDocuments({ status: 'pending' }),
      CorrectionRequest.countDocuments({ status: 'pending' }),
      Attendance.find({ date: clock.date })
        .populate('teacher', 'name email department')
        .sort({ checkIn: -1, _id: -1 })
        .limit(8)
        .lean(),
    ]);

    return {
      role: 'admin',
      date: clock.date,
      summary: {
        totalTeachers,
        present,
        late,
        absent,
        approvedLeave,
        pendingRequests: pendingLeaves + pendingCorrections,
      },
      recentAttendance,
    };
  }

  const monthStart = `${clock.date.slice(0, 7)}-01`;
  const [todayRecord, approvedLeave, monthRecords, recentAttendance] = await Promise.all([
    Attendance.findOne({ teacher: user._id, date: clock.date }).lean(),
    findApprovedLeave(user._id, clock.date),
    Attendance.find({ teacher: user._id, date: { $gte: monthStart, $lte: clock.date } })
      .select('status')
      .lean(),
    Attendance.find({ teacher: user._id })
      .sort({ date: -1, _id: -1 })
      .limit(5)
      .lean(),
  ]);
  const presentDays = monthRecords.filter((record) => record.status === 'present').length;
  const lateDays = monthRecords.filter((record) => record.status === 'late').length;
  const absentDays = monthRecords.filter((record) => record.status === 'absent').length;
  const attendanceDays = presentDays + lateDays + absentDays;
  const todayStatus = todayRecord?.status || calculateStatus({
    checkInMinute: null,
    currentMinute: clock.minutes,
    workStartTime: settings.workStartTime,
    workEndTime: settings.workEndTime,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    approvedLeave: Boolean(approvedLeave),
  });

  return {
    role: 'teacher',
    date: clock.date,
    today: todayRecord,
    todayStatus,
    settings: {
      workStartTime: settings.workStartTime,
      workEndTime: settings.workEndTime,
      gracePeriodMinutes: settings.gracePeriodMinutes,
      timeZone: settings.timeZone,
    },
    summary: {
      presentDays,
      lateDays,
      absentDays,
      attendanceRate: attendanceDays ? Math.round(((presentDays + lateDays) / attendanceDays) * 100) : 0,
    },
    recentAttendance,
  };
}

module.exports = {
  calculateCorrectedStatus,
  calculateStatus,
  checkIn,
  checkOut,
  ensureTodayRecords,
  getDashboard,
  getMyHistory,
  getSchoolDate,
  listAttendance,
};
