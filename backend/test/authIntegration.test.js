const assert = require('node:assert/strict');
const cookieParser = require('cookie-parser');
const express = require('express');
const request = require('supertest');
const { test } = require('node:test');

process.env.SUPABASE_URL ||= 'https://test-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY ||= 'test-publishable-key';
process.env.NODE_ENV = 'test';

const { createAuthController } = require('../src/controllers/authController');
const { createAuthMiddleware } = require('../src/middleware/authMiddleware');
const authRoutes = require('../src/routes/authRoutes');

function createApp({ authService, identityService, registrationService }) {
  const controller = createAuthController({ authService, identityService, registrationService });
  const middleware = createAuthMiddleware({ authService, identityService });
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.post('/auth/register', controller.register);
  app.post('/auth/login', controller.login);
  app.post('/auth/logout', controller.logout);
  app.get('/auth/me', middleware.authenticate, controller.getProfile);
  app.get('/admin-only', middleware.authenticate, middleware.authorize('admin'), (req, res) => {
    res.status(200).json({ id: req.user._id.toString() });
  });

  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ error: { code: error.code || 'ERROR', message: error.message } });
  });

  return app;
}

function confirmedAuthUser(overrides = {}) {
  return {
    id: 'supabase-auth-uuid',
    email: 'teacher@example.test',
    email_confirmed_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function trustedMongoUser(overrides = {}) {
  return {
    _id: { toString: () => 'legacy-mongo-object-id' },
    name: 'Existing Teacher',
    email: 'teacher@example.test',
    role: 'teacher',
    status: 'active',
    department: null,
    ...overrides,
  };
}

function createDependencies(overrides = {}) {
  const calls = { identity: [], logout: [], registration: [], signup: [] };
  const authService = {
    registerWithSupabase: async (details) => {
      calls.signup.push(details);
      return { user: confirmedAuthUser(), session: null };
    },
    getRegistrationConfirmation: (data) => ({
      confirmationRequired: !data.session,
      email: data.user.email,
    }),
    loginWithSupabase: async () => ({
      user: confirmedAuthUser(),
      session: { access_token: 'supabase-access-token', expires_in: 1800 },
    }),
    getSupabaseUser: async (token) => {
      if (token === 'invalid-token') {
        const error = new Error('Invalid token');
        error.status = 401;
        throw error;
      }
      return confirmedAuthUser();
    },
    logoutFromSupabase: async (token) => calls.logout.push(token),
    ...overrides.authService,
  };
  const identityService = {
    resolveAuthenticatedUser: async (...args) => {
      calls.identity.push(args);
      return trustedMongoUser();
    },
    getMappedUser: async () => trustedMongoUser(),
    ...overrides.identityService,
  };
  const registrationService = {
    createRegistrationIntent: async (details) => {
      calls.registration.push({ type: 'create', details });
      return { _id: 'a'.repeat(64) };
    },
    attachRegistrationIntent: async (intentId, supabaseUserId) => {
      calls.registration.push({ type: 'attach', intentId, supabaseUserId });
    },
    failRegistrationIntent: async (intentId) => {
      calls.registration.push({ type: 'fail', intentId });
    },
    ...overrides.registrationService,
  };

  return { authService, identityService, registrationService, calls };
}

test('registration with pending email confirmation returns no session cookie', async () => {
  const dependencies = createDependencies();
  const app = createApp(dependencies);
  const response = await request(app).post('/auth/register').send({
    name: 'New Teacher',
    email: 'new@example.test',
    password: 'test-password-only',
    departmentId: '507f1f77bcf86cd799439011',
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.confirmationRequired, true);
  assert.equal(response.body.email, 'teacher@example.test');
  assert.equal(response.headers['set-cookie'], undefined);
  assert.equal(dependencies.calls.identity.length, 0);
  assert.equal(dependencies.calls.registration[0].details.departmentId, '507f1f77bcf86cd799439011');
  assert.equal(dependencies.calls.signup[0].registrationIntentId, 'a'.repeat(64));
  assert.deepEqual(dependencies.calls.registration[1], {
    type: 'attach',
    intentId: 'a'.repeat(64),
    supabaseUserId: 'supabase-auth-uuid',
  });
});

test('registration validation rejects invalid fields before calling Supabase', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const response = await request(app).post('/api/auth/register').send({
    name: 'T',
    email: 'not-an-email',
    password: 'short',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.deepEqual(new Set(response.body.error.details.map(({ field }) => field)), new Set(['name', 'email', 'password']));
});

test('registration reports Mongo profile-link failures without issuing an auth cookie', async () => {
  const dependencies = createDependencies({
    authService: {
      registerWithSupabase: async () => ({
        user: confirmedAuthUser(),
        session: { access_token: 'supabase-access-token', expires_in: 1800 },
      }),
      getRegistrationConfirmation: () => ({ confirmationRequired: false }),
    },
    identityService: {
      resolveAuthenticatedUser: async () => { throw new Error('MongoDB unavailable'); },
    },
  });
  const response = await request(createApp(dependencies)).post('/auth/register').send({
    name: 'New Teacher',
    email: 'new@example.test',
    password: 'test-password-only',
    departmentId: '507f1f77bcf86cd799439011',
  });

  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'PROFILE_LINK_FAILED');
  assert.match(response.body.error.message, /Sign in again to retry/);
  assert.equal(response.headers['set-cookie'], undefined);
});

test('password login without a Supabase session is rejected as unconfirmed', async () => {
  const dependencies = createDependencies({
    authService: {
      loginWithSupabase: async () => ({ user: confirmedAuthUser(), session: null }),
    },
  });
  const response = await request(createApp(dependencies)).post('/auth/login').send({
    email: 'teacher@example.test',
    password: 'test-password-only',
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'EMAIL_NOT_CONFIRMED');
  assert.equal(response.headers['set-cookie'], undefined);
  assert.equal(dependencies.calls.identity.length, 0);
});

test('login sets an HttpOnly access-token cookie and keeps the legacy Mongo ID', async () => {
  const dependencies = createDependencies();
  const app = createApp(dependencies);
  const response = await request(app).post('/auth/login').send({
    email: 'teacher@example.test',
    password: 'test-password-only',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, 'legacy-mongo-object-id');
  assert.equal(response.body.user.role, 'teacher');
  assert.match(response.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(response.headers['set-cookie'][0], /Max-Age=1800/i);
  assert.equal(dependencies.calls.identity[0][1], 'test-password-only');
});

test('protected profile validates Supabase token and returns the mapped Mongo profile', async () => {
  const dependencies = createDependencies();
  const response = await request(createApp(dependencies))
    .get('/auth/me')
    .set('Cookie', 'facultyDeskAuth=supabase-access-token');

  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, 'legacy-mongo-object-id');
  assert.equal(response.body.user.department, null);
});

test('authenticated profile returns the Mongo department reference after login', async () => {
  const dependencies = createDependencies({
    identityService: {
      getMappedUser: async () => trustedMongoUser({
        department: { toString: () => 'mongo-department-object-id' },
      }),
    },
  });
  const response = await request(createApp(dependencies))
    .get('/auth/me')
    .set('Cookie', 'facultyDeskAuth=supabase-access-token');

  assert.equal(response.status, 200);
  assert.equal(response.body.user.department, 'mongo-department-object-id');
});

test('invalid and unconfirmed Supabase sessions are rejected', async () => {
  const invalidDependencies = createDependencies();
  const invalid = await request(createApp(invalidDependencies))
    .get('/auth/me')
    .set('Cookie', 'facultyDeskAuth=invalid-token');
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.error.code, 'INVALID_SESSION');

  const unconfirmedDependencies = createDependencies({
    authService: { getSupabaseUser: async () => confirmedAuthUser({ email_confirmed_at: null }) },
  });
  const unconfirmed = await request(createApp(unconfirmedDependencies))
    .get('/auth/me')
    .set('Cookie', 'facultyDeskAuth=supabase-access-token');
  assert.equal(unconfirmed.status, 401);
  assert.equal(unconfirmed.body.error.code, 'EMAIL_NOT_CONFIRMED');
});

test('authorization uses the trusted Mongo role and logout revokes the cookie token', async () => {
  const teacherDependencies = createDependencies();
  const denied = await request(createApp(teacherDependencies))
    .get('/admin-only')
    .set('Cookie', 'facultyDeskAuth=supabase-access-token');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'FORBIDDEN');

  const adminDependencies = createDependencies({
    identityService: { getMappedUser: async () => trustedMongoUser({ role: 'admin' }) },
  });
  const allowed = await request(createApp(adminDependencies))
    .get('/admin-only')
    .set('Cookie', 'facultyDeskAuth=supabase-access-token');
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.id, 'legacy-mongo-object-id');

  const logout = await request(createApp(adminDependencies))
    .post('/auth/logout')
    .set('Cookie', 'facultyDeskAuth=supabase-access-token');
  assert.equal(logout.status, 200);
  assert.deepEqual(adminDependencies.calls.logout, ['supabase-access-token']);
  assert.match(logout.headers['set-cookie'][0], /Expires=/i);
});