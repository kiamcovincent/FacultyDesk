const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createAuthIdentityService } = require('../src/services/authIdentityService');
const User = require('../src/models/User');

function createUserModel(records) {
  return {
    findOne(filter) {
      const user = records.find((record) => Object.entries(filter).every(([key, value]) => record[key] === value)) || null;
      return { select: async () => user };
    },
    async create(values) {
      const user = { ...values, _id: 'new-mongo-object-id' };
      records.push(user);
      return user;
    },
  };
}

function confirmedAuthUser(overrides = {}) {
  return {
    id: 'supabase-user-uuid',
    email: 'teacher@example.test',
    email_confirmed_at: '2026-10-01T00:00:00Z',
    user_metadata: { name: 'New Teacher', role: 'admin' },
    ...overrides,
  };
}

test('legacy Mongo user links only after Supabase identity and legacy password are both verified', async () => {
  const legacyUser = {
    _id: 'legacy-mongo-object-id',
    email: 'teacher@example.test',
    name: 'Existing Admin',
    role: 'admin',
    status: 'active',
    passwordHash: 'existing-hash',
    comparePassword: async (password) => password === 'legacy-password',
    async save() {},
  };
  const records = [legacyUser];
  const identityService = createAuthIdentityService({ UserModel: createUserModel(records) });
  const linked = await identityService.resolveAuthenticatedUser(confirmedAuthUser(), 'legacy-password');

  assert.equal(linked._id, 'legacy-mongo-object-id');
  assert.equal(linked.supabaseUserId, 'supabase-user-uuid');
  assert.equal(linked.role, 'admin');
});

test('email match alone never links an existing Mongo user', async () => {
  const legacyUser = {
    _id: 'legacy-mongo-object-id',
    email: 'teacher@example.test',
    role: 'teacher',
    status: 'active',
    passwordHash: 'existing-hash',
    comparePassword: async () => false,
    async save() {},
  };
  const identityService = createAuthIdentityService({ UserModel: createUserModel([legacyUser]) });

  await assert.rejects(
    identityService.resolveAuthenticatedUser(confirmedAuthUser(), 'different-password'),
    { code: 'ACCOUNT_LINK_REQUIRED' }
  );
  assert.equal(legacyUser.supabaseUserId, undefined);
});

test('an existing identity link cannot be reassigned to another Supabase user', async () => {
  const legacyUser = {
    _id: 'legacy-mongo-object-id',
    email: 'teacher@example.test',
    role: 'teacher',
    status: 'active',
    passwordHash: 'existing-hash',
    supabaseUserId: 'different-supabase-user',
    comparePassword: async () => true,
    async save() {},
  };
  const identityService = createAuthIdentityService({ UserModel: createUserModel([legacyUser]) });

  await assert.rejects(
    identityService.resolveAuthenticatedUser(confirmedAuthUser(), 'legacy-password'),
    { code: 'ACCOUNT_LINK_CONFLICT' }
  );
  assert.equal(legacyUser.supabaseUserId, 'different-supabase-user');
});

test('new confirmed Supabase user receives a new Mongo ID with server-assigned teacher role', async () => {
  const records = [];
  const identityService = createAuthIdentityService({
    UserModel: createUserModel(records),
    bcryptModule: { hash: async (value, rounds) => `bcrypt:${rounds}:${value}` },
    randomBytes: () => Buffer.from('random-only'),
  });
  const user = await identityService.resolveAuthenticatedUser(confirmedAuthUser(), 'supabase-password');

  assert.equal(user._id, 'new-mongo-object-id');
  assert.equal(user.supabaseUserId, 'supabase-user-uuid');
  assert.equal(user.role, 'teacher');
  assert.equal(user.status, 'active');
  assert.match(user.passwordHash, /^bcrypt:12:/);
  assert.notEqual(user.passwordHash, 'supabase-password');
});

test('confirmed Supabase identity consumes its opaque intent and stores the Mongo department reference', async () => {
  const records = [];
  const departmentId = 'mongo-department-object-id';
  const intent = {
    _id: 'a'.repeat(64),
    email: 'teacher@example.test',
    name: 'Intent Teacher',
    department: departmentId,
    status: 'pending',
    async save() {},
  };
  const identityService = createAuthIdentityService({
    UserModel: createUserModel(records),
    RegistrationIntentModel: { findById: async (id) => id === intent._id ? intent : null },
    DepartmentModel: { findOne: async (filter) => filter._id === departmentId && filter.active ? { _id: departmentId } : null },
    bcryptModule: { hash: async (value, rounds) => `bcrypt:${rounds}:${value}` },
    randomBytes: () => Buffer.from('random-only'),
  });
  const authUser = confirmedAuthUser({
    user_metadata: {
      name: 'Untrusted metadata name',
      role: 'admin',
      facultyDeskRegistrationIntentId: intent._id,
    },
  });

  const user = await identityService.resolveAuthenticatedUser(authUser, 'supabase-password');

  assert.equal(user.name, 'Intent Teacher');
  assert.equal(user.role, 'teacher');
  assert.equal(user.department, departmentId);
  assert.equal(user.supabaseUserId, authUser.id);
  assert.equal(intent.supabaseUserId, authUser.id);
  assert.equal(intent.status, 'complete');
});

test('confirmed Supabase identity can complete a registration intent without a department', async () => {
  const records = [];
  const intent = {
    _id: 'c'.repeat(64),
    email: 'teacher@example.test',
    name: 'Unassigned Teacher',
    department: null,
    status: 'pending',
    supabaseUserId: 'supabase-user-uuid',
    async save() {},
  };
  const identityService = createAuthIdentityService({
    UserModel: createUserModel(records),
    RegistrationIntentModel: { findById: async () => intent },
    bcryptModule: { hash: async () => 'stored-random-hash' },
    randomBytes: () => Buffer.from('random-only'),
  });
  const authUser = confirmedAuthUser({
    user_metadata: { facultyDeskRegistrationIntentId: intent._id },
  });

  const user = await identityService.resolveAuthenticatedUser(authUser, 'supabase-password');

  assert.equal(user.role, 'teacher');
  assert.equal(user.department, null);
  assert.equal(user.supabaseUserId, authUser.id);
  assert.equal(intent.status, 'complete');
});

test('registration intent cannot be consumed by a different email or Supabase identity', async () => {
  let createCalls = 0;
  const identityService = createAuthIdentityService({
    UserModel: {
      findOne() { return { select: async () => null }; },
      async create() { createCalls += 1; },
    },
    RegistrationIntentModel: {
      findById: async () => ({
        _id: 'b'.repeat(64),
        email: 'teacher@example.test',
        name: 'Intent Teacher',
        department: 'mongo-department-object-id',
        supabaseUserId: 'another-supabase-user',
        status: 'pending',
      }),
    },
  });
  const authUser = confirmedAuthUser({
    user_metadata: { facultyDeskRegistrationIntentId: 'b'.repeat(64) },
  });

  await assert.rejects(identityService.resolveAuthenticatedUser(authUser, 'password'), {
    code: 'REGISTRATION_INTENT_INVALID',
  });
  assert.equal(createCalls, 0);
});

test('unconfirmed and inactive accounts cannot establish a Mongo identity link', async () => {
  const inactiveUser = {
    _id: 'inactive-mongo-id',
    email: 'teacher@example.test',
    role: 'teacher',
    status: 'inactive',
    passwordHash: 'existing-hash',
    comparePassword: async () => true,
    async save() {},
  };
  const identityService = createAuthIdentityService({ UserModel: createUserModel([inactiveUser]) });

  await assert.rejects(
    identityService.resolveAuthenticatedUser(confirmedAuthUser({ email_confirmed_at: null }), 'password'),
    { code: 'EMAIL_NOT_CONFIRMED' }
  );
  await assert.rejects(
    identityService.resolveAuthenticatedUser(confirmedAuthUser(), 'password'),
    { code: 'ACCOUNT_INACTIVE' }
  );
  assert.equal(inactiveUser.supabaseUserId, undefined);
});

test('Mongo identity bridge uses a unique sparse field without replacing _id', () => {
  const supabaseUserIdPath = User.schema.path('supabaseUserId');
  const mappingIndex = User.schema.indexes().find(([keys, options]) =>
    keys.supabaseUserId === 1 && options.unique && options.sparse
  );

  assert.ok(supabaseUserIdPath);
  assert.ok(mappingIndex);
  assert.ok(User.schema.path('_id'));

  const serializedUser = User.hydrate({
    _id: 'legacy-mongo-object-id',
    supabaseUserId: 'supabase-user-uuid',
  }).toJSON();
  assert.equal(serializedUser.supabaseUserId, undefined);
});

test('subjects retain optional department references for teacher-owned subjects', () => {
  const Subject = require('../src/models/Subject');
  const subject = new Subject({ name: 'Biology', code: 'BIO', teachers: ['507f1f77bcf86cd799439011'] });

  assert.equal(subject.department, null);
  assert.equal(Subject.schema.path('department').options.required, undefined);
});