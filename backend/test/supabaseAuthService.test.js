const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.SUPABASE_URL ||= 'https://test-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY ||= 'test-publishable-key';

const {
  getRegistrationConfirmation,
  getTeacherProfile,
  loginWithSupabase,
  logoutFromSupabase,
  registerWithSupabase,
} = require('../src/services/supabaseAuthService');

function authorizationHeader(options) {
  const headers = options.headers;
  return typeof headers.get === 'function'
    ? headers.get('authorization')
    : headers[Object.keys(headers).find((key) => key.toLowerCase() === 'authorization')];
}

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('registration response maps Supabase email confirmation without creating an app session', () => {
  assert.deepEqual(
    getRegistrationConfirmation({
      user: { email: 'teacher@example.test' },
      session: null,
    }),
    { confirmationRequired: true, email: 'teacher@example.test' }
  );

  assert.deepEqual(
    getRegistrationConfirmation({
      user: { email: 'teacher@example.test', email_confirmed_at: null },
      session: { access_token: 'mock-access-token' },
    }),
    { confirmationRequired: true, email: 'teacher@example.test' }
  );

  assert.deepEqual(
    getRegistrationConfirmation({
      user: { email: 'teacher@example.test', email_confirmed_at: '2026-10-01T00:00:00Z' },
      session: { access_token: 'mock-access-token' },
    }),
    { confirmationRequired: false, email: 'teacher@example.test' }
  );
});

test('registration normalizes identity and preserves the email-confirmation pending result', async () => {
  const originalFetch = global.fetch;
  let captured;

  global.fetch = async (input, options) => {
    captured = { url: new URL(input), options };
    return responseJson({
      id: 'pending-auth-id',
      email: 'teacher@example.test',
      user_metadata: { name: 'Taylor Teacher' },
    });
  };

  try {
    const result = await registerWithSupabase({
      name: ' Taylor Teacher ',
      email: ' TAYLOR@EXAMPLE.TEST ',
      password: 'test-password-only',
    });
    const requestBody = JSON.parse(captured.options.body);

    assert.equal(captured.url.pathname, '/auth/v1/signup');
    assert.equal(requestBody.email, 'taylor@example.test');
    assert.equal(requestBody.data.name, 'Taylor Teacher');
    assert.equal(result.user.id, 'pending-auth-id');
    assert.equal(result.session, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test('password login normalizes the email and returns the Supabase session', async () => {
  const originalFetch = global.fetch;
  let captured;

  global.fetch = async (input, options) => {
    captured = { url: new URL(input), options };
    return responseJson({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: { id: 'verified-auth-id', email: 'teacher@example.test' },
    });
  };

  try {
    const result = await loginWithSupabase({
      email: ' TEACHER@EXAMPLE.TEST ',
      password: 'test-password-only',
    });
    const requestBody = JSON.parse(captured.options.body);

    assert.equal(captured.url.pathname, '/auth/v1/token');
    assert.equal(captured.url.searchParams.get('grant_type'), 'password');
    assert.equal(requestBody.email, 'teacher@example.test');
    assert.equal(result.session.access_token, 'mock-access-token');
    assert.equal(result.user.id, 'verified-auth-id');
  } finally {
    global.fetch = originalFetch;
  }
});

test('logout revokes only the supplied local Supabase session', async () => {
  const originalFetch = global.fetch;
  let captured;

  global.fetch = async (input, options) => {
    captured = { url: new URL(input), options };
    return new Response(null, { status: 204 });
  };

  try {
    await logoutFromSupabase('mock-access-token');

    assert.equal(captured.url.pathname, '/auth/v1/logout');
    assert.equal(captured.url.searchParams.get('scope'), 'local');
    assert.equal(authorizationHeader(captured.options), 'Bearer mock-access-token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('teacher profile lookup uses the verified Supabase user and access token', async () => {
  const originalFetch = global.fetch;
  const requests = [];

  global.fetch = async (input, options) => {
    const url = new URL(input);
    requests.push({ url, options });

    if (url.pathname === '/auth/v1/user') {
      return new Response(
        JSON.stringify({ id: 'verified-auth-id', email: 'teacher@example.test', user_metadata: {} }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify([
        {
          id: 'teacher-profile-id',
          auth_user_id: 'verified-auth-id',
          full_name: 'Example Teacher',
          email: 'teacher@example.test',
          role: 'teacher',
          status: 'active',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' } }
    );
  };

  try {
    const profile = await getTeacherProfile('session-access-token');
    const authRequest = requests.find(({ url }) => url.pathname === '/auth/v1/user');
    const profileRequest = requests.find(({ url }) => url.pathname === '/rest/v1/teachers');

    assert.equal(authorizationHeader(authRequest.options), 'Bearer session-access-token');
    assert.equal(authorizationHeader(profileRequest.options), 'Bearer session-access-token');
    assert.equal(profileRequest.url.searchParams.get('auth_user_id'), 'eq.verified-auth-id');
    assert.equal(profileRequest.url.searchParams.get('select'), 'id,auth_user_id,full_name,email,role,status');
    assert.equal(profile.auth_user_id, 'verified-auth-id');
  } finally {
    global.fetch = originalFetch;
  }
});