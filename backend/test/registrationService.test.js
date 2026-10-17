const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { test } = require('node:test');
const { createRegistrationService } = require('../src/services/registrationService');

const departmentId = new mongoose.Types.ObjectId();

test('registration intent requires an active Mongo department and stores its ObjectId', async () => {
  let departmentFilter;
  let createdIntent;
  const service = createRegistrationService({
    DepartmentModel: {
      findOne: async (filter) => {
        departmentFilter = filter;
        return { _id: departmentId };
      },
    },
    RegistrationIntentModel: {
      create: async (values) => {
        createdIntent = values;
        return values;
      },
    },
    randomBytes: () => Buffer.alloc(32, 7),
  });

  const intent = await service.createRegistrationIntent({
    name: '  Taylor Teacher ',
    email: ' TAYLOR@EXAMPLE.TEST ',
    departmentId: departmentId.toString(),
  });

  assert.deepEqual(departmentFilter, { _id: departmentId.toString(), active: true });
  assert.equal(createdIntent._id.length, 64);
  assert.equal(createdIntent.name, 'Taylor Teacher');
  assert.equal(createdIntent.email, 'taylor@example.test');
  assert.equal(createdIntent.department, departmentId);
  assert.equal(intent.status, 'pending');
});

test('registration intent can be created without a department when none is available', async () => {
  let departmentLookup = false;
  let createdIntent;
  const service = createRegistrationService({
    DepartmentModel: { findOne: async () => { departmentLookup = true; } },
    RegistrationIntentModel: { create: async (values) => { createdIntent = values; return values; } },
    randomBytes: () => Buffer.alloc(32, 8),
  });

  await service.createRegistrationIntent({
    name: 'Taylor Teacher',
    email: 'taylor@example.test',
    departmentId: '',
  });

  assert.equal(departmentLookup, false);
  assert.equal(createdIntent.department, null);
});

test('registration intent rejects invalid or inactive departments without writing', async () => {
  let createCalls = 0;
  const service = createRegistrationService({
    DepartmentModel: { findOne: async () => null },
    RegistrationIntentModel: { create: async () => { createCalls += 1; } },
  });

  await assert.rejects(
    service.createRegistrationIntent({ name: 'Taylor Teacher', email: 'taylor@example.test', departmentId: 'not-an-id' }),
    { code: 'INVALID_DEPARTMENT' }
  );
  await assert.rejects(
    service.createRegistrationIntent({ name: 'Taylor Teacher', email: 'taylor@example.test', departmentId: departmentId.toString() }),
    { code: 'DEPARTMENT_UNAVAILABLE' }
  );
  assert.equal(createCalls, 0);
});

test('registration intents link to the Supabase user ID and fail by status without deletion', async () => {
  let intent = {
    _id: 'intent-id',
    status: 'pending',
    async save() {},
  };
  let updateCall;
  const service = createRegistrationService({
    RegistrationIntentModel: {
      findById: async () => intent,
      updateOne: async (...args) => { updateCall = args; },
    },
  });

  await service.attachRegistrationIntent('intent-id', 'verified-supabase-id');
  assert.equal(intent.supabaseUserId, 'verified-supabase-id');
  await service.failRegistrationIntent('intent-id');
  assert.deepEqual(updateCall, [
    { _id: 'intent-id', status: 'pending' },
    { $set: { status: 'failed' } },
  ]);
});