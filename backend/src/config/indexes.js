const Schedule = require('../models/Schedule');
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

module.exports = { ensureScheduleIndexes, ensureAuthIdentityIndex };
