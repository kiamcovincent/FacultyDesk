const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const ClassAttendance = require('../models/ClassAttendance');
const RegistrationIntent = require('../models/RegistrationIntent');
const User = require('../models/User');

async function ensureAuthIdentityIndex() {
  await User.collection.createIndex(
    { supabaseUserId: 1 },
    { unique: true, sparse: true, name: 'unique_supabase_user_id' }
  );
}

async function ensureScheduleIndexes() {
  const { db } = Schedule.collection.conn;
  const collectionName = Schedule.collection.collectionName;
  const collections = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();

  if (!collections.length) {
    await Schedule.createCollection();
  }

  const indexes = await Schedule.collection.indexes();
  const legacyIndex = indexes.find((index) =>
    index.name === 'teacher_1_dayOfWeek_1_startTime_1' && !index.partialFilterExpression
  );

  if (legacyIndex) {
    await Schedule.collection.dropIndex(legacyIndex.name);
  }

  await Schedule.collection.createIndex(
    { teacher: 1, dayOfWeek: 1, startTime: 1 },
    {
      unique: true,
      partialFilterExpression: { active: true },
      name: 'active_teacher_schedule_slot_unique',
    }
  );
}

async function ensureClassroomIndexes() {
  await Student.collection.createIndex(
    { studentNumber: 1 },
    { unique: true, name: 'unique_student_number' }
  );
  await ClassAttendance.collection.createIndex(
    { schedule: 1, date: 1 },
    { unique: true, name: 'unique_schedule_attendance_date' }
  );
}

async function ensureRegistrationIntentIndex() {
  await RegistrationIntent.collection.createIndex(
    { supabaseUserId: 1 },
    { unique: true, sparse: true, name: 'unique_registration_supabase_user_id' }
  );
}

module.exports = {
  ensureScheduleIndexes,
  ensureAuthIdentityIndex,
  ensureClassroomIndexes,
  ensureRegistrationIntentIndex,
};
