const mongoose = require('mongoose');
const ClassAttendance = require('../models/ClassAttendance');
const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const Subject = require('../models/Subject');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalizeStudentNumber(value) {
  return value.trim().toUpperCase();
}

function ownedSubjectFilter(subjectId, user) {
  return {
    _id: subjectId,
    active: true,
    teachers: user._id,
  };
}

function ownedScheduleFilter(scheduleId, user) {
  return { _id: scheduleId, teacher: user._id, active: true };
}

function normalizeAttendanceRecords(records, roster) {
  if (!Array.isArray(records) || records.length !== roster.length) {
    throw httpError(400, 'INCOMPLETE_ATTENDANCE', 'Set an attendance status for every active student in this class.');
  }

  const rosterIds = new Set(roster.map((student) => student._id.toString()));
  const submittedIds = new Set();
  const normalized = [];

  for (const record of records) {
    const studentId = record.studentId?.toString();
    if (!studentId || !rosterIds.has(studentId) || submittedIds.has(studentId)) {
      throw httpError(400, 'INVALID_ATTENDANCE_ROSTER', 'Attendance must contain each active class student exactly once.');
    }
    if (!['present', 'absent', 'late'].includes(record.status)) {
      throw httpError(400, 'INVALID_ATTENDANCE_STATUS', 'Choose Present, Absent, or Late for each student.');
    }
    submittedIds.add(studentId);
    normalized.push({ student: studentId, status: record.status });
  }

  if (submittedIds.size !== rosterIds.size) {
    throw httpError(400, 'INCOMPLETE_ATTENDANCE', 'Set an attendance status for every active student in this class.');
  }

  return normalized;
}

function createClassroomService({
  StudentModel = Student,
  SubjectModel = Subject,
  ScheduleModel = Schedule,
  ClassAttendanceModel = ClassAttendance,
} = {}) {
  async function requireOwnedSubject(subjectId, user) {
    if (!mongoose.isValidObjectId(subjectId)) {
      throw httpError(400, 'INVALID_SUBJECT', 'Select a valid subject.');
    }
    const subject = await SubjectModel.findOne(ownedSubjectFilter(subjectId, user));
    if (!subject) throw httpError(404, 'SUBJECT_NOT_FOUND', 'Active subject assigned to this teacher not found.');
    return subject;
  }

  async function requireOwnedSchedule(scheduleId, user) {
    if (!mongoose.isValidObjectId(scheduleId)) {
      throw httpError(400, 'INVALID_SCHEDULE', 'Select a valid class schedule.');
    }
    const schedule = await ScheduleModel.findOne(ownedScheduleFilter(scheduleId, user));
    if (!schedule) throw httpError(404, 'SCHEDULE_NOT_FOUND', 'Active class schedule not found.');
    const subject = await requireOwnedSubject(schedule.subject, user);
    return { schedule, subject };
  }

  async function listStudents(user, subjectId) {
    const subject = await requireOwnedSubject(subjectId, user);
    const students = await StudentModel.find({ subjects: subject._id, active: true })
      .sort({ lastName: 1, firstName: 1, studentNumber: 1 });
    return { students };
  }

  async function addStudent(user, input) {
    const subject = await requireOwnedSubject(input.subjectId, user);
    const studentNumber = normalizeStudentNumber(input.studentNumber);
    let student = await StudentModel.findOne({ studentNumber });

    if (!student) {
      try {
        student = await StudentModel.create({
          studentNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          subjects: [subject._id],
        });
        return { student };
      } catch (error) {
        if (error.code !== 11000) throw error;
        student = await StudentModel.findOne({ studentNumber });
        if (!student) throw error;
      }
    }

    if (!student.active) {
      throw httpError(409, 'STUDENT_ARCHIVED', 'This student is archived and cannot be enrolled.');
    }
    if (student.firstName.toLowerCase() !== input.firstName.toLowerCase()
      || student.lastName.toLowerCase() !== input.lastName.toLowerCase()) {
      throw httpError(409, 'STUDENT_NUMBER_CONFLICT', 'That student number is already associated with a different name.');
    }
    if (student.subjects.some((id) => id.toString() === subject._id.toString())) {
      throw httpError(409, 'STUDENT_ALREADY_ENROLLED', 'This student is already enrolled in the selected subject.');
    }

    student.subjects.addToSet
      ? student.subjects.addToSet(subject._id)
      : student.subjects.push(subject._id);
    await student.save();
    return { student };
  }

  async function getClassAttendance(user, scheduleId, date) {
    if (!isValidDateKey(date)) throw httpError(400, 'INVALID_DATE', 'Enter a valid class date.');
    const { schedule, subject } = await requireOwnedSchedule(scheduleId, user);
    const students = await StudentModel.find({ subjects: subject._id, active: true })
      .sort({ lastName: 1, firstName: 1, studentNumber: 1 });
    const attendance = await ClassAttendanceModel.findOne({ schedule: schedule._id, date });
    const savedStatuses = new Map(
      (attendance?.records || []).map((record) => [record.student.toString(), record.status])
    );

    return {
      schedule: {
        id: schedule._id,
        className: schedule.className,
        subject: { id: subject._id, name: subject.name, code: subject.code },
        dayOfWeek: schedule.dayOfWeek,
      },
      date,
      description: attendance?.description || '',
      students: students.map((student) => ({
        id: student._id,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        status: savedStatuses.get(student._id.toString()) || '',
      })),
      saved: Boolean(attendance),
    };
  }

  async function saveClassAttendance(user, input) {
    if (!isValidDateKey(input.date)) throw httpError(400, 'INVALID_DATE', 'Enter a valid class date.');
    const { schedule, subject } = await requireOwnedSchedule(input.scheduleId, user);
    const roster = await StudentModel.find({ subjects: subject._id, active: true });
    if (roster.length === 0) throw httpError(409, 'EMPTY_CLASS', 'Add students to this subject before taking attendance.');
    const records = normalizeAttendanceRecords(input.records, roster);
    const filter = { schedule: schedule._id, date: input.date };
    const update = {
      $set: { description: input.description || '', records, updatedBy: user._id },
      $setOnInsert: { schedule: schedule._id, date: input.date },
    };

    let attendance;
    try {
      attendance = await ClassAttendanceModel.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      attendance = await ClassAttendanceModel.findOneAndUpdate(filter, {
        $set: update.$set,
      }, { new: true, runValidators: true });
      if (!attendance) throw error;
    }

    return {
      attendance: {
        id: attendance._id,
        schedule: schedule._id,
        date: attendance.date,
        description: attendance.description,
        records: attendance.records,
      },
    };
  }

  return { addStudent, getClassAttendance, listStudents, saveClassAttendance };
}

module.exports = {
  ...createClassroomService(),
  createClassroomService,
  isValidDateKey,
  normalizeAttendanceRecords,
  normalizeStudentNumber,
  ownedScheduleFilter,
  ownedSubjectFilter,
};