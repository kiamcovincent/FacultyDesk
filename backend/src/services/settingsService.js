const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function getCurrentSettings() {
  return Settings.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function updateSettings(input, actor, ipAddress) {
  const updates = {};
  for (const field of ['schoolName', 'workStartTime', 'workEndTime', 'gracePeriodMinutes', 'timeZone']) {
    if (Object.hasOwn(input, field)) updates[field] = input[field];
  }

  if (updates.timeZone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: updates.timeZone }).format(new Date());
    } catch {
      throw httpError(400, 'INVALID_TIME_ZONE', 'Enter a valid IANA time zone, such as UTC or Africa/Lagos.');
    }
  }

  const settings = await getCurrentSettings();
  const before = {
    schoolName: settings.schoolName,
    workStartTime: settings.workStartTime,
    workEndTime: settings.workEndTime,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    timeZone: settings.timeZone,
  };
  Object.assign(settings, updates);

  try {
    await settings.save();
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw httpError(400, 'INVALID_SETTINGS', error.message);
    }
    throw error;
  }

  const after = {
    schoolName: settings.schoolName,
    workStartTime: settings.workStartTime,
    workEndTime: settings.workEndTime,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    timeZone: settings.timeZone,
  };
  await AuditLog.create({
    actor,
    action: 'settings.updated',
    entityType: 'Settings',
    entityId: settings._id,
    changes: { before, after },
    ipAddress,
  });

  return settings;
}

module.exports = { getCurrentSettings, updateSettings };
