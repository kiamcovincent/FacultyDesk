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