const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const app = require('../src/app');
const User = require('../src/models/User');
const Attendance = require('../src/models/Attendance');
const LeaveRequest = require('../src/models/LeaveRequest');
const CorrectionRequest = require('../src/models/CorrectionRequest');
const Notification = require('../src/models/Notification');
const Settings = require('../src/models/Settings');
const Department = require('../src/models/Department');
const Subject = require('../src/models/Subject');
const Schedule = require('../src/models/Schedule');
const AuditLog = require('../src/models/AuditLog');
const { authorize } = require('../src/middleware/authMiddleware');
const attendanceService = require('../src/services/attendanceService');
const testMongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/teacher_attendance_test';
const { ensureScheduleIndexes } = require('../src/config/indexes');

function currentUtcTime() {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );

  return `${values.hour}:${values.minute}`;
}

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

async function authCookie(email, password) {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(response.status, 200);
  return response.headers['set-cookie'].find((value) => value.startsWith('facultyDeskAuth=')).split(';')[0];
}

before(async () => {
  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 5000 });
  await ensureScheduleIndexes();
  await User.init();
  await Attendance.deleteMany({});
  await LeaveRequest.deleteMany({});
  await CorrectionRequest.deleteMany({});
  await Notification.deleteMany({});
  await Settings.deleteMany({});
  await Department.deleteMany({});
  await Subject.deleteMany({});
  await Schedule.deleteMany({});
  await AuditLog.deleteMany({});
  await User.deleteMany({});
});

after(async () => {
  await Attendance.deleteMany({});
  await LeaveRequest.deleteMany({});
  await CorrectionRequest.deleteMany({});
  await Notification.deleteMany({});
  await Settings.deleteMany({});
  await Department.deleteMany({});
  await Subject.deleteMany({});
  await Schedule.deleteMany({});
  await AuditLog.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

test('teacher registration stores a password hash and returns an httpOnly cookie', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Taylor Teacher', email: 'TAYLOR@example.com', password: 'TeacherPass123' });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, 'taylor@example.com');
  assert.equal(Object.hasOwn(response.body.user, 'passwordHash'), false);

  const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('facultyDeskAuth='));
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/i);

  const storedUser = await User.findOne({ email: 'taylor@example.com' }).select('+passwordHash');
  assert.ok(storedUser.passwordHash);
  assert.notEqual(storedUser.passwordHash, 'TeacherPass123');
});

test('login rejects invalid credentials and /me requires a valid cookie', async () => {
  const invalidLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'taylor@example.com', password: 'incorrect-password' });
  assert.equal(invalidLogin.status, 401);

  const unauthenticatedProfile = await request(app).get('/api/auth/me');
  assert.equal(unauthenticatedProfile.status, 401);

  const validLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'taylor@example.com', password: 'TeacherPass123' });
  assert.equal(validLogin.status, 200);

  const cookie = validLogin.headers['set-cookie']?.find((value) => value.startsWith('facultyDeskAuth='));
  const profile = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.email, 'taylor@example.com');
});

test('registration validates input and rejects duplicate email addresses', async () => {
  const invalid = await request(app)
    .post('/api/auth/register')
    .send({ name: 'T', email: 'not-an-email', password: 'short' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

  const duplicate = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Taylor Again', email: 'taylor@example.com', password: 'AnotherPass123' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'EMAIL_IN_USE');
});

test('role middleware denies a teacher on an administrator-only route', async () => {
  const roleTestApp = express();
  roleTestApp.get(
    '/admin-only',
    (req, res, next) => {
      req.user = { role: 'teacher' };
      next();
    },
    authorize('admin'),
    (req, res) => res.sendStatus(200)
  );

  const response = await request(roleTestApp).get('/admin-only');
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('attendance status follows configured grace and absence rules', () => {
  const rules = {
    workStartTime: '08:00',
    workEndTime: '16:00',
    gracePeriodMinutes: 10,
  };

  assert.equal(attendanceService.calculateStatus({ ...rules, checkInMinute: 480, currentMinute: 480 }), 'present');
  assert.equal(attendanceService.calculateStatus({ ...rules, checkInMinute: 491, currentMinute: 491 }), 'late');
  assert.equal(attendanceService.calculateStatus({ ...rules, checkInMinute: null, currentMinute: 960 }), 'absent');
  assert.equal(attendanceService.calculateStatus({ ...rules, checkInMinute: null, currentMinute: 960, approvedLeave: true }), 'approved_leave');
});

test('attendance check-in/out prevents duplicates and history is teacher-scoped', async () => {
  const settings = await Settings.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        workStartTime: currentUtcTime(),
        workEndTime: '23:59',
        gracePeriodMinutes: 10,
        timeZone: 'UTC',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  assert.equal(settings.timeZone, 'UTC');

  const teacherCookie = await authCookie('taylor@example.com', 'TeacherPass123');
  const checkoutBeforeCheckin = await request(app)
    .post('/api/attendance/check-out')
    .set('Cookie', teacherCookie);
  assert.equal(checkoutBeforeCheckin.status, 409);
  assert.equal(checkoutBeforeCheckin.body.error.code, 'CHECK_IN_REQUIRED');

  const checkin = await request(app)
    .post('/api/attendance/check-in')
    .set('Cookie', teacherCookie);
  assert.equal(checkin.status, 201);
  assert.equal(checkin.body.record.status, 'present');

  const duplicateCheckin = await request(app)
    .post('/api/attendance/check-in')
    .set('Cookie', teacherCookie);
  assert.equal(duplicateCheckin.status, 409);

  const checkout = await request(app)
    .post('/api/attendance/check-out')
    .set('Cookie', teacherCookie);
  assert.equal(checkout.status, 200);
  assert.ok(checkout.body.record.checkOut);

  const duplicateCheckout = await request(app)
    .post('/api/attendance/check-out')
    .set('Cookie', teacherCookie);
  assert.equal(duplicateCheckout.status, 409);

  const history = await request(app)
    .get(`/api/attendance/my-history?date=${checkin.body.record.date}&page=1&limit=5`)
    .set('Cookie', teacherCookie);
  assert.equal(history.status, 200);
  assert.equal(history.body.pagination.total, 1);

  const otherTeacher = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Morgan Teacher', email: 'morgan@example.com', password: 'AnotherPass123' });
  assert.equal(otherTeacher.status, 201);
  const otherCookie = otherTeacher.headers['set-cookie'].find((value) => value.startsWith('facultyDeskAuth=')).split(';')[0];
  const otherHistory = await request(app)
    .get('/api/attendance/my-history')
    .set('Cookie', otherCookie);
  assert.equal(otherHistory.status, 200);
  assert.equal(otherHistory.body.pagination.total, 0);

  const teacherCannotListAll = await request(app)
    .get('/api/attendance')
    .set('Cookie', teacherCookie);
  assert.equal(teacherCannotListAll.status, 403);
});

test('approved leave blocks check-in and admin listing records absences', async () => {
  const date = currentUtcDate();
  const now = new Date();
  const nowParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  const currentMinute = Number(nowParts.hour) * 60 + Number(nowParts.minute);
  const workEndMinute = currentMinute > 1 ? currentMinute - 1 : currentMinute + 2;
  const workEndTime = `${String(Math.floor(workEndMinute / 60)).padStart(2, '0')}:${String(workEndMinute % 60).padStart(2, '0')}`;

  await Settings.findOneAndUpdate(
    { key: 'default' },
    { $set: { workStartTime: '00:00', workEndTime, gracePeriodMinutes: 10, timeZone: 'UTC' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const passwordHash = await bcrypt.hash('LeavePass123', 4);
  const leaveTeacher = await User.create({
    name: 'Leave Teacher',
    email: 'leave@example.com',
    passwordHash,
    role: 'teacher',
  });
  const absentTeacher = await User.create({
    name: 'Absent Teacher',
    email: 'absent@example.com',
    passwordHash: await bcrypt.hash('AbsentPass123', 4),
    role: 'teacher',
  });
  await LeaveRequest.create({
    teacher: leaveTeacher._id,
    startDate: new Date(`${date}T00:00:00.000Z`),
    endDate: new Date(`${date}T00:00:00.000Z`),
    reason: 'Approved personal leave',
    status: 'approved',
  });

  const leaveCookie = await authCookie('leave@example.com', 'LeavePass123');
  const blockedCheckin = await request(app)
    .post('/api/attendance/check-in')
    .set('Cookie', leaveCookie);
  assert.equal(blockedCheckin.status, 409);
  assert.equal(blockedCheckin.body.error.code, 'APPROVED_LEAVE');

  await User.create({
    name: 'Test Administrator',
    email: 'test-admin@example.com',
    passwordHash: await bcrypt.hash('AdminTestPass123', 4),
    role: 'admin',
  });
  const adminCookie = await authCookie('test-admin@example.com', 'AdminTestPass123');
  const allAttendance = await request(app)
    .get(`/api/attendance?date=${date}&page=1&limit=100&sortBy=date&order=desc`)
    .set('Cookie', adminCookie);
  assert.equal(allAttendance.status, 200);
  assert.ok(allAttendance.body.records.some((record) => record.teacher._id === leaveTeacher.id && record.status === 'approved_leave'));

  if (currentMinute > 1) {
    const absentRecord = await Attendance.findOne({ teacher: absentTeacher._id, date });
    assert.equal(absentRecord.status, 'absent');
    assert.equal(absentRecord.source, 'system');
  }
});

test('teacher dashboard returns personal attendance data and teacher management is admin-only', async () => {
  const teacherCookie = await authCookie('taylor@example.com', 'TeacherPass123');
  const dashboard = await request(app)
    .get('/api/dashboard')
    .set('Cookie', teacherCookie);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.role, 'teacher');
  assert.equal(dashboard.body.date, currentUtcDate());
  assert.equal(typeof dashboard.body.summary.attendanceRate, 'number');

  const teacherListDenied = await request(app)
    .get('/api/teachers')
    .set('Cookie', teacherCookie);
  assert.equal(teacherListDenied.status, 403);

  const noSessionDashboard = await request(app).get('/api/dashboard');
  assert.equal(noSessionDashboard.status, 401);
});

test('admin can create, filter, edit, and deactivate teacher accounts', async () => {
  await User.create({
    name: 'Management Administrator',
    email: 'management-admin@example.com',
    passwordHash: await bcrypt.hash('ManagementPass123', 4),
    role: 'admin',
  });
  const adminCookie = await authCookie('management-admin@example.com', 'ManagementPass123');

  const department = await Department.create({ name: 'Science', code: 'SCI' });
  const created = await request(app)
    .post('/api/teachers')
    .set('Cookie', adminCookie)
    .send({
      name: 'Casey Teacher',
      email: 'casey@example.com',
      password: 'CaseyTeacher123',
      department: department._id.toString(),
    });
  assert.equal(created.status, 201);
  const teacherId = created.body.teacher.id;
  assert.equal(created.body.teacher.role, 'teacher');

  const filtered = await request(app)
    .get('/api/teachers?search=casey&status=active&page=1&limit=10')
    .set('Cookie', adminCookie);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.pagination.total, 1);
  assert.equal(filtered.body.teachers[0].department.name, 'Science');

  const edited = await request(app)
    .patch(`/api/teachers/${teacherId}`)
    .set('Cookie', adminCookie)
    .send({ name: 'Casey Updated' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.teacher.name, 'Casey Updated');

  const deactivated = await request(app)
    .patch(`/api/teachers/${teacherId}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'inactive' });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.teacher.status, 'inactive');

  const inactiveLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'casey@example.com', password: 'CaseyTeacher123' });
  assert.equal(inactiveLogin.status, 401);
});

test('admin dashboard returns database totals and recent activity', async () => {
  await User.create({
    name: 'Dashboard Administrator',
    email: 'dashboard-admin@example.com',
    passwordHash: await bcrypt.hash('DashboardPass123', 4),
    role: 'admin',
  });
  const adminCookie = await authCookie('dashboard-admin@example.com', 'DashboardPass123');
  const dashboard = await request(app)
    .get('/api/dashboard/admin')
    .set('Cookie', adminCookie);

  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.date, currentUtcDate());
  assert.ok(dashboard.body.summary.totalTeachers >= 1);
  assert.ok(Array.isArray(dashboard.body.recentAttendance));
});

test('admin manages departments, subjects, and schedules with teacher-scoped views', async () => {
  const teacher = await User.findOne({ email: 'taylor@example.com' });
  await User.create({
    name: 'Academic Administrator',
    email: 'academic-admin@example.com',
    passwordHash: await bcrypt.hash('AcademicAdmin123', 4),
    role: 'admin',
  });
  const adminCookie = await authCookie('academic-admin@example.com', 'AcademicAdmin123');

  const departmentResponse = await request(app)
    .post('/api/departments')
    .set('Cookie', adminCookie)
    .send({ name: 'Languages', code: 'LANG' });
  assert.equal(departmentResponse.status, 201);
  const departmentId = departmentResponse.body.department._id;

  const subjectResponse = await request(app)
    .post('/api/subjects')
    .set('Cookie', adminCookie)
    .send({ name: 'English Literature', code: 'ENG-LIT', department: departmentId, teachers: [teacher._id.toString()] });
  assert.equal(subjectResponse.status, 201);
  const subjectId = subjectResponse.body.subject._id;

  const scheduleResponse = await request(app)
    .post('/api/schedules')
    .set('Cookie', adminCookie)
    .send({
      teacher: teacher._id.toString(),
      subject: subjectId,
      className: 'Year 10',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      timeZone: 'UTC',
    });
  assert.equal(scheduleResponse.status, 201);

  const overlapResponse = await request(app)
    .post('/api/schedules')
    .set('Cookie', adminCookie)
    .send({
      teacher: teacher._id.toString(),
      subject: subjectId,
      className: 'Year 11',
      dayOfWeek: 1,
      startTime: '09:30',
      endTime: '10:30',
      timeZone: 'UTC',
    });
  assert.equal(overlapResponse.status, 409);
  assert.equal(overlapResponse.body.error.code, 'SCHEDULE_OVERLAP');

  const scheduleId = scheduleResponse.body.schedule._id;
  const deactivatedSchedule = await request(app)
    .patch(`/api/schedules/${scheduleId}`)
    .set('Cookie', adminCookie)
    .send({ active: false });
  assert.equal(deactivatedSchedule.status, 200);

  const reusedSlot = await request(app)
    .post('/api/schedules')
    .set('Cookie', adminCookie)
    .send({
      teacher: teacher._id.toString(),
      subject: subjectId,
      className: 'Year 11',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      timeZone: 'UTC',
    });
  assert.equal(reusedSlot.status, 201);

  const teacherCookie = await authCookie('taylor@example.com', 'TeacherPass123');
  const teacherSubjects = await request(app).get('/api/subjects').set('Cookie', teacherCookie);
  const teacherSchedules = await request(app).get('/api/schedules').set('Cookie', teacherCookie);
  assert.equal(teacherSubjects.status, 200);
  assert.equal(teacherSubjects.body.pagination.total, 1);
  assert.equal(teacherSchedules.status, 200);
  assert.equal(teacherSchedules.body.pagination.total, 1);

  const otherTeacher = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Unassigned Teacher', email: 'unassigned@example.com', password: 'UnassignedPass123' });
  const otherCookie = otherTeacher.headers['set-cookie'].find((value) => value.startsWith('facultyDeskAuth=')).split(';')[0];
  const otherSchedules = await request(app).get('/api/schedules').set('Cookie', otherCookie);
  assert.equal(otherSchedules.body.pagination.total, 0);

  const auditEntries = await AuditLog.countDocuments({ actor: adminCookie ? { $exists: true } : null });
  assert.ok(auditEntries >= 3);
});

test('teachers submit leave requests and admins review, audit, and notify', async () => {
  const teacher = await User.findOne({ email: 'taylor@example.com' });
  await User.create({
    name: 'Leave Administrator',
    email: 'leave-admin@example.com',
    passwordHash: await bcrypt.hash('LeaveAdminPass123', 4),
    role: 'admin',
  });
  const teacherCookie = await authCookie('taylor@example.com', 'TeacherPass123');
  const adminCookie = await authCookie('leave-admin@example.com', 'LeaveAdminPass123');
  const futureDate = new Date();
  futureDate.setUTCDate(futureDate.getUTCDate() + 2);
  const dateKey = futureDate.toISOString().slice(0, 10);

  const submitted = await request(app)
    .post('/api/leave-requests')
    .set('Cookie', teacherCookie)
    .send({ startDate: dateKey, endDate: dateKey, reason: 'Medical appointment' });
  assert.equal(submitted.status, 201);

  const ownRequests = await request(app).get('/api/leave-requests').set('Cookie', teacherCookie);
  assert.equal(ownRequests.status, 200);
  assert.equal(ownRequests.body.pagination.total, 1);

  const teacherCannotReview = await request(app)
    .patch(`/api/leave-requests/${submitted.body.request._id}/review`)
    .set('Cookie', teacherCookie)
    .send({ status: 'approved' });
  assert.equal(teacherCannotReview.status, 403);

  const reviewed = await request(app)
    .patch(`/api/leave-requests/${submitted.body.request._id}/review`)
    .set('Cookie', adminCookie)
    .send({ status: 'approved', reviewerNote: 'Approved for the requested date.' });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.request.status, 'approved');

  const leaveAttendance = await Attendance.findOne({ teacher: teacher._id, date: dateKey });
  assert.equal(leaveAttendance.status, 'approved_leave');
  const teacherNotifications = await request(app).get('/api/notifications?unread=true').set('Cookie', teacherCookie);
  assert.equal(teacherNotifications.status, 200);
  const approvalNotification = teacherNotifications.body.notifications.find((item) => item.title === 'Leave request approved');
  assert.ok(approvalNotification);
  const readNotification = await request(app)
    .patch(`/api/notifications/${approvalNotification._id}/read`)
    .set('Cookie', teacherCookie);
  assert.equal(readNotification.status, 200);
  const anotherUserCannotReadIt = await request(app)
    .patch(`/api/notifications/${approvalNotification._id}/read`)
    .set('Cookie', adminCookie);
  assert.equal(anotherUserCannotReadIt.status, 404);
  assert.ok(await AuditLog.exists({ action: 'leave_request.approved', entityId: submitted.body.request._id }));
});

test('correction requests update only the teacher-owned record and log before/after values', async () => {
  const teacher = await User.findOne({ email: 'taylor@example.com' });
  const attendance = await Attendance.findOne({ teacher: teacher._id, date: currentUtcDate() });
  assert.ok(attendance?.checkIn);

  await User.create({
    name: 'Correction Administrator',
    email: 'correction-admin@example.com',
    passwordHash: await bcrypt.hash('CorrectionAdmin123', 4),
    role: 'admin',
  });
  const teacherCookie = await authCookie('taylor@example.com', 'TeacherPass123');
  const adminCookie = await authCookie('correction-admin@example.com', 'CorrectionAdmin123');
  const requestedCheckIn = new Date(`${attendance.date}T08:00:00.000Z`).toISOString();
  const requestedCheckOut = new Date(`${attendance.date}T16:00:00.000Z`).toISOString();

  const submitted = await request(app)
    .post('/api/correction-requests')
    .set('Cookie', teacherCookie)
    .send({
      attendance: attendance._id.toString(),
      requestedCheckIn,
      requestedCheckOut,
      reason: 'The recorded check-in time was incorrect.',
    });
  assert.equal(submitted.status, 201);

  const otherTeacher = await User.create({
    name: 'Private Teacher',
    email: 'private-teacher@example.com',
    passwordHash: await bcrypt.hash('PrivateTeacher123', 4),
    role: 'teacher',
  });
  const otherAttendance = await Attendance.create({
    teacher: otherTeacher._id,
    date: attendance.date,
    checkIn: new Date(`${attendance.date}T07:30:00.000Z`),
    status: 'present',
  });
  const privateRecordAttempt = await request(app)
    .post('/api/correction-requests')
    .set('Cookie', teacherCookie)
    .send({ attendance: otherAttendance._id.toString(), requestedCheckIn, reason: 'Change another record.' });
  assert.equal(privateRecordAttempt.status, 404);

  const reviewed = await request(app)
    .patch(`/api/correction-requests/${submitted.body.request._id}/review`)
    .set('Cookie', adminCookie)
    .send({ status: 'approved', reviewerNote: 'Adjusted to the register.' });
  assert.equal(reviewed.status, 200);
  const corrected = await Attendance.findById(attendance._id);
  assert.equal(corrected.checkIn.toISOString(), requestedCheckIn);
  assert.equal(corrected.checkOut.toISOString(), requestedCheckOut);

  const auditRecord = await AuditLog.findOne({ action: 'correction_request.approved', entityId: submitted.body.request._id });
  assert.equal(new Date(auditRecord.changes.before.checkIn).toISOString(), attendance.checkIn.toISOString());
  assert.equal(new Date(auditRecord.changes.after.checkIn).toISOString(), requestedCheckIn);
});

test('admin reports filter by date, department, subject, and status and export safe CSV', async () => {
  await User.create({
    name: 'Reports Administrator',
    email: 'reports-admin@example.com',
    passwordHash: await bcrypt.hash('ReportsAdmin123', 4),
    role: 'admin',
  });
  const adminCookie = await authCookie('reports-admin@example.com', 'ReportsAdmin123');
  const department = await Department.create({ name: 'Report Department', code: 'RPT' });
  const reportTeacher = await User.create({
    name: '=2+2',
    email: 'report-teacher@example.com',
    passwordHash: await bcrypt.hash('ReportTeacher123', 4),
    role: 'teacher',
    department: department._id,
  });
  const subject = await Subject.create({
    name: 'Report Subject',
    code: 'RPT-101',
    department: department._id,
    teachers: [reportTeacher._id],
  });
  const date = currentUtcDate();
  await Attendance.create({
    teacher: reportTeacher._id,
    date,
    checkIn: new Date(`${date}T09:30:00.000Z`),
    status: 'late',
    notes: 'Late arrival',
  });

  const filters = new URLSearchParams({
    from: date,
    to: date,
    departmentId: department._id.toString(),
    subjectId: subject._id.toString(),
    status: 'late',
    page: '1',
    limit: '10',
  });
  const report = await request(app).get(`/api/reports?${filters}`).set('Cookie', adminCookie);
  assert.equal(report.status, 200);
  assert.equal(report.body.summary.total, 1);
  assert.equal(report.body.summary.late, 1);
  assert.equal(report.body.records[0].teacher.name, '=2+2');
  assert.match(report.body.subjectScope, /teachers assigned to this subject/);

  const teacherCookie = await authCookie('taylor@example.com', 'TeacherPass123');
  const forbiddenReport = await request(app).get('/api/reports').set('Cookie', teacherCookie);
  assert.equal(forbiddenReport.status, 403);

  const csv = await request(app).get(`/api/reports?${filters}&format=csv`).set('Cookie', adminCookie);
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.headers['content-disposition'], /attachment/);
  assert.match(csv.text, /"'=2\+2"/);
  assert.ok(await AuditLog.exists({ action: 'attendance_report.exported' }));
});

test('admins update validated attendance settings and filter the audit log', async () => {
  await User.create({
    name: 'Settings Administrator',
    email: 'settings-admin@example.com',
    passwordHash: await bcrypt.hash('SettingsAdmin123', 4),
    role: 'admin',
  });
  const adminCookie = await authCookie('settings-admin@example.com', 'SettingsAdmin123');
  const initial = await request(app).get('/api/settings').set('Cookie', adminCookie);
  assert.equal(initial.status, 200);

  const updated = await request(app)
    .patch('/api/settings')
    .set('Cookie', adminCookie)
    .send({
      schoolName: 'FacultyDesk North',
      workStartTime: '09:00',
      workEndTime: '17:30',
      gracePeriodMinutes: 15,
      timeZone: 'Africa/Lagos',
    });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.settings.workStartTime, '09:00');
  assert.equal(updated.body.settings.timeZone, 'Africa/Lagos');

  const invalidHours = await request(app)
    .patch('/api/settings')
    .set('Cookie', adminCookie)
    .send({ workStartTime: '18:00', workEndTime: '17:00' });
  assert.equal(invalidHours.status, 400);
  assert.equal(invalidHours.body.error.code, 'INVALID_SETTINGS');

  const invalidZone = await request(app)
    .patch('/api/settings')
    .set('Cookie', adminCookie)
    .send({ timeZone: 'Not/A_Real_Zone' });
  assert.equal(invalidZone.status, 400);
  assert.equal(invalidZone.body.error.code, 'INVALID_TIME_ZONE');

  const teacherCookie = await authCookie('taylor@example.com', 'TeacherPass123');
  const teacherSettings = await request(app).get('/api/settings').set('Cookie', teacherCookie);
  const teacherAuditLogs = await request(app).get('/api/audit-logs').set('Cookie', teacherCookie);
  assert.equal(teacherSettings.status, 403);
  assert.equal(teacherAuditLogs.status, 403);

  const auditLogs = await request(app)
    .get('/api/audit-logs?action=settings.updated&page=1&limit=10')
    .set('Cookie', adminCookie);
  assert.equal(auditLogs.status, 200);
  assert.equal(auditLogs.body.pagination.total, 1);
  assert.equal(auditLogs.body.logs[0].actor.name, 'Settings Administrator');
});
