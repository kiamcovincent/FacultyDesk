const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Department = require('../models/Department');
const RegistrationIntent = require('../models/RegistrationIntent');

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function createRegistrationService({
  DepartmentModel = Department,
  RegistrationIntentModel = RegistrationIntent,
  randomBytes = crypto.randomBytes,
} = {}) {
  async function createRegistrationIntent({ name, email, departmentId }) {
    let department = null;
    if (departmentId && !mongoose.isValidObjectId(departmentId)) {
      throw httpError(400, 'INVALID_DEPARTMENT', 'Select a valid department.');
    }
    if (departmentId) {
      department = await DepartmentModel.findOne({ _id: departmentId, active: true });
      if (!department) {
        throw httpError(422, 'DEPARTMENT_UNAVAILABLE', 'The selected department is unavailable. Choose an active department.');
      }
    }

    const intent = await RegistrationIntentModel.create({
      _id: randomBytes(32).toString('hex'),
      email: email.trim().toLowerCase(),
      name: name.trim(),
      department: department?._id || null,
      status: 'pending',
    });
    return intent;
  }

  async function attachRegistrationIntent(intentId, supabaseUserId) {
    const intent = await RegistrationIntentModel.findById(intentId);
    if (!intent || intent.status !== 'pending') {
      throw httpError(409, 'REGISTRATION_INTENT_UNAVAILABLE', 'Registration could not be linked. Submit the form again.');
    }
    if (intent.supabaseUserId && intent.supabaseUserId !== supabaseUserId) {
      throw httpError(409, 'REGISTRATION_INTENT_CONFLICT', 'Registration could not be linked to this sign-in.');
    }
    intent.supabaseUserId = supabaseUserId;
    await intent.save();
    return intent;
  }

  async function failRegistrationIntent(intentId) {
    if (!intentId) return;
    await RegistrationIntentModel.updateOne(
      { _id: intentId, status: 'pending' },
      { $set: { status: 'failed' } }
    );
  }

  return { attachRegistrationIntent, createRegistrationIntent, failRegistrationIntent };
}

module.exports = { ...createRegistrationService(), createRegistrationService };