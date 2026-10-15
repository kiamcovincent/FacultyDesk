const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const User = require('../models/User');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function intersectIds(current, next) {
  const nextSet = new Set(next.map((id) => id.toString()));
  const matches = current === null ? [...nextSet] : current.filter((id) => nextSet.has(id.toString()));
  return matches.map((id) => new mongoose.Types.ObjectId(id));
}

async function makeReportFilter(query) {
  const today = new Date().toISOString().slice(0, 10);
  const from = query.from || `${today.slice(0, 7)}-01`;
  const to = query.to || today;
  if (from > to) throw httpError(400, 'INVALID_DATE_RANGE', 'The start date must be on or before the end date.');

  const filter = { date: { $gte: from, $lte: to } };
  if (query.status) filter.status = query.status;

  let teacherIds = null;
  if (query.teacherId) teacherIds = intersectIds(teacherIds, [query.teacherId]);

  if (query.departmentId) {
    const department = await Department.findById(query.departmentId).select('_id');
    if (!department) throw httpError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
    const teachers = await User.find({ role: 'teacher', department: department._id }).select('_id').lean();
    teacherIds = intersectIds(teacherIds, teachers.map((teacher) => teacher._id));
  }

  if (query.subjectId) {
    const subject = await Subject.findById(query.subjectId).select('teachers');
    if (!subject) throw httpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');
    teacherIds = intersectIds(teacherIds, subject.teachers);
  }

  if (teacherIds !== null) filter.teacher = { $in: teacherIds };
  return { filter, from, to };
}

function csvCell(value) {
  let safe = value === null || value === undefined ? '' : String(value);
  if (/^[=+@-]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

function attendanceCsv(records) {
  const rows = [[
    'date',
    'teacher_name',
    'teacher_email',
    'department',
    'status',
    'check_in',
    'check_out',
    'notes',
  ]];

  for (const record of records) {
    rows.push([
      record.date,
      record.teacher?.name,
      record.teacher?.email,
      record.teacher?.department?.name,
      record.status,
      record.checkIn?.toISOString(),
      record.checkOut?.toISOString(),
      record.notes,
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

async function getReport(query, exportCsv = false) {
  const { filter, from, to } = await makeReportFilter(query);
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = exportCsv ? 10001 : Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const [records, total, grouped] = await Promise.all([
    Attendance.find(filter)
      .populate({ path: 'teacher', select: 'name email department', populate: { path: 'department', select: 'name code' } })
      .sort({ date: -1, checkIn: -1, _id: -1 })
      .skip(exportCsv ? 0 : (page - 1) * limit)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(filter),
    Attendance.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  if (exportCsv && total > 10000) {
    throw httpError(413, 'REPORT_TOO_LARGE', 'Narrow the date range or filters to export 10,000 records or fewer.');
  }

  const counts = Object.fromEntries(grouped.map((item) => [item._id, item.count]));
  const result = {
    filters: { from, to, teacherId: query.teacherId || null, departmentId: query.departmentId || null, subjectId: query.subjectId || null, status: query.status || null },
    subjectScope: query.subjectId ? 'Attendance is filtered to teachers assigned to this subject; records are not linked to individual class sessions.' : null,
    summary: {
      total,
      present: counts.present || 0,
      late: counts.late || 0,
      absent: counts.absent || 0,
      approvedLeave: counts.approved_leave || 0,
    },
    records,
    pagination: { page, limit: exportCsv ? total : limit, total, pages: exportCsv ? 1 : Math.ceil(total / limit) },
  };

  if (exportCsv) result.csv = attendanceCsv(records);
  return result;
}

module.exports = { getReport };
