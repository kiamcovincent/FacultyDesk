const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { test } = require('node:test');
const Schedule = require('../src/models/Schedule');
const {
  getSubjectScheduleFilter,
  getTeacherIds,
  getTeacherScheduleId,
} = require('../src/services/academicOwnership');

const teacherId = new mongoose.Types.ObjectId();
const otherTeacherId = new mongoose.Types.ObjectId();
const subjectId = new mongoose.Types.ObjectId();

test('teacher subject creation always assigns the authenticated teacher only', () => {
  assert.deepEqual(
    getTeacherIds({ role: 'teacher', _id: teacherId }, [otherTeacherId]),
    [teacherId]
  );
});

test('teacher schedule ownership ignores submitted teacher IDs and scopes the subject', () => {
  assert.equal(getTeacherScheduleId({ role: 'teacher', _id: teacherId }, otherTeacherId), teacherId);
  assert.deepEqual(getSubjectScheduleFilter({ role: 'teacher', _id: teacherId }, subjectId), {
    _id: subjectId,
    active: true,
    teachers: teacherId,
  });
});

test('administrator subject and schedule assignments remain selectable', () => {
  assert.deepEqual(getTeacherIds({ role: 'admin' }, [teacherId]), [teacherId]);
  assert.equal(getTeacherScheduleId({ role: 'admin' }, teacherId), teacherId);
  assert.deepEqual(getSubjectScheduleFilter({ role: 'admin' }, subjectId), {
    _id: subjectId,
    active: true,
  });
});

test('schedule schema rejects end times that are not later than start times', async () => {
  const schedule = new Schedule({
    teacher: teacherId,
    subject: subjectId,
    className: 'Biology 101',
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '10:00',
  });

  await assert.rejects(schedule.validate(), /Schedule end time must be later/);
});