const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { test } = require('node:test');
const ClassAttendance = require('../src/models/ClassAttendance');
const Student = require('../src/models/Student');
const {
  isValidDateKey,
  createClassroomService,
  normalizeAttendanceRecords,
  normalizeStudentNumber,
  ownedScheduleFilter,
  ownedSubjectFilter,
} = require('../src/services/classroomService');

const teacherId = new mongoose.Types.ObjectId();
const subjectId = new mongoose.Types.ObjectId();
const scheduleId = new mongoose.Types.ObjectId();
const studentId = new mongoose.Types.ObjectId();
const secondStudentId = new mongoose.Types.ObjectId();

test('student identifiers normalize consistently and teacher subject scope is enforced', () => {
  assert.equal(normalizeStudentNumber(' st-001 '), 'ST-001');
  assert.deepEqual(ownedSubjectFilter(subjectId, { _id: teacherId }), {
    _id: subjectId,
    active: true,
    teachers: teacherId,
  });
  assert.deepEqual(ownedScheduleFilter(scheduleId, { _id: teacherId }), {
    _id: scheduleId,
    teacher: teacherId,
    active: true,
  });
});

test('class attendance date validation rejects impossible calendar dates', () => {
  assert.equal(isValidDateKey('2026-10-17'), true);
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.equal(isValidDateKey('17-10-2026'), false);
});

test('attendance requires one valid status per current roster student', () => {
  const roster = [{ _id: studentId }, { _id: secondStudentId }];
  const normalized = normalizeAttendanceRecords([
    { studentId: studentId.toString(), status: 'present' },
    { studentId: secondStudentId.toString(), status: 'late' },
  ], roster);

  assert.deepEqual(normalized, [
    { student: studentId.toString(), status: 'present' },
    { student: secondStudentId.toString(), status: 'late' },
  ]);
  assert.throws(
    () => normalizeAttendanceRecords([{ studentId: studentId.toString(), status: 'present' }], roster),
    { code: 'INCOMPLETE_ATTENDANCE' }
  );
  assert.throws(
    () => normalizeAttendanceRecords([
      { studentId: studentId.toString(), status: 'present' },
      { studentId: studentId.toString(), status: 'absent' },
    ], roster),
    { code: 'INVALID_ATTENDANCE_ROSTER' }
  );
  assert.throws(
    () => normalizeAttendanceRecords([
      { studentId: studentId.toString(), status: 'excused' },
      { studentId: secondStudentId.toString(), status: 'late' },
    ], roster),
    { code: 'INVALID_ATTENDANCE_STATUS' }
  );
});

test('student number and schedule/date constraints are represented in Mongo schemas', () => {
  const studentNumberIndex = Student.schema.indexes().find(([keys, options]) =>
    keys.studentNumber === 1 && options.unique
  );
  const attendanceIndex = ClassAttendance.schema.indexes().find(([keys, options]) =>
    keys.schedule === 1 && keys.date === 1 && options.unique
  );

  assert.ok(studentNumberIndex);
  assert.ok(attendanceIndex);
  assert.ok(Student.schema.path('subjects'));
  assert.deepEqual(ClassAttendance.schema.path('records.0.status').enumValues, ['present', 'absent', 'late']);
});

test('adding a student resolves and writes only to the authenticated teacher subject', async () => {
  let subjectFilter;
  let createdStudent;
  const service = createClassroomService({
    SubjectModel: {
      findOne: async (filter) => {
        subjectFilter = filter;
        return { _id: subjectId, name: 'Biology', code: 'BIO' };
      },
    },
    StudentModel: {
      findOne: async () => null,
      create: async (document) => {
        createdStudent = { _id: studentId, ...document };
        return createdStudent;
      },
    },
  });

  const result = await service.addStudent(
    { _id: teacherId, role: 'teacher' },
    { subjectId: subjectId.toString(), studentNumber: ' bio-004 ', firstName: 'Sam', lastName: 'Rivera' }
  );

  assert.deepEqual(subjectFilter, { _id: subjectId.toString(), active: true, teachers: teacherId });
  assert.equal(createdStudent.studentNumber, 'BIO-004');
  assert.deepEqual(createdStudent.subjects, [subjectId]);
  assert.equal(result.student._id, studentId);
});

test('class attendance reload reads the owned schedule, current subject roster, and saved statuses', async () => {
  let scheduleFilter;
  let subjectFilter;
  let attendanceFilter;
  const service = createClassroomService({
    ScheduleModel: {
      findOne: async (filter) => {
        scheduleFilter = filter;
        return { _id: scheduleId, subject: subjectId, className: 'Room 5', dayOfWeek: 1 };
      },
    },
    SubjectModel: {
      findOne: async (filter) => {
        subjectFilter = filter;
        return { _id: subjectId, name: 'Biology', code: 'BIO' };
      },
    },
    StudentModel: {
      find: (filter) => ({
        sort: async () => {
          assert.deepEqual(filter, { subjects: subjectId, active: true });
          return [{ _id: studentId, studentNumber: 'BIO-004', firstName: 'Sam', lastName: 'Rivera' }];
        },
      }),
    },
    ClassAttendanceModel: {
      findOne: async (filter) => {
        attendanceFilter = filter;
        return { description: 'Lab practical', records: [{ student: studentId, status: 'late' }] };
      },
    },
  });

  const result = await service.getClassAttendance(
    { _id: teacherId, role: 'teacher' },
    scheduleId.toString(),
    '2026-10-17'
  );

  assert.deepEqual(scheduleFilter, { _id: scheduleId.toString(), teacher: teacherId, active: true });
  assert.deepEqual(subjectFilter, { _id: subjectId, active: true, teachers: teacherId });
  assert.deepEqual(attendanceFilter, { schedule: scheduleId, date: '2026-10-17' });
  assert.equal(result.students[0].status, 'late');
  assert.equal(result.description, 'Lab practical');
  assert.equal(result.saved, true);
});

test('class attendance saves are scoped to one owned schedule and date', async () => {
  let saveFilter;
  let saveUpdate;
  const service = createClassroomService({
    ScheduleModel: {
      findOne: async () => ({ _id: scheduleId, subject: subjectId, className: 'Room 5', dayOfWeek: 1 }),
    },
    SubjectModel: {
      findOne: async () => ({ _id: subjectId, name: 'Biology', code: 'BIO' }),
    },
    StudentModel: {
      find: async () => [{ _id: studentId }],
    },
    ClassAttendanceModel: {
      findOneAndUpdate: async (filter, update) => {
        saveFilter = filter;
        saveUpdate = update;
        return { _id: new mongoose.Types.ObjectId(), schedule: scheduleId, date: '2026-10-17', ...update.$set };
      },
    },
  });

  await service.saveClassAttendance(
    { _id: teacherId, role: 'teacher' },
    {
      scheduleId: scheduleId.toString(),
      date: '2026-10-17',
      description: 'Morning session',
      records: [{ studentId: studentId.toString(), status: 'present' }],
    }
  );

  assert.deepEqual(saveFilter, { schedule: scheduleId, date: '2026-10-17' });
  assert.equal(saveUpdate.$set.updatedBy, teacherId);
  assert.deepEqual(saveUpdate.$set.records, [{ student: studentId.toString(), status: 'present' }]);
});