const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { test } = require('node:test');

process.env.SUPABASE_URL ||= 'https://test-project.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY ||= 'test-publishable-key';

const healthRouter = require('../src/routes/healthRoutes');

function createApp({ mongoReadyState = 1, supabaseError = null } = {}) {
  const router = healthRouter.createHealthRouter({
    mongoConnection: { readyState: mongoReadyState },
    supabaseClient: {
      from(table) {
        assert.equal(table, 'teachers');
        return {
          select(column) {
            assert.equal(column, 'id');
            return {
              async limit(count) {
                assert.equal(count, 0);
                return { error: supabaseError };
              },
            };
          },
        };
      },
    },
  });
  const app = express();
  app.use('/health', router);
  return app;
}

test('health reports both database services while preserving the legacy database field', async () => {
  const response = await request(createApp()).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.database, 'connected');
  assert.deepEqual(response.body.databases, { mongodb: 'connected', supabase: 'connected' });
});

test('health returns unavailable when Supabase is unavailable', async () => {
  const response = await request(createApp({ supabaseError: new Error('unavailable') })).get('/health');

  assert.equal(response.status, 503);
  assert.equal(response.body.databases.mongodb, 'connected');
  assert.equal(response.body.databases.supabase, 'unavailable');
});

test('health returns unavailable when MongoDB is unavailable', async () => {
  const response = await request(createApp({ mongoReadyState: 0 })).get('/health');

  assert.equal(response.status, 503);
  assert.equal(response.body.databases.mongodb, 'unavailable');
  assert.equal(response.body.databases.supabase, 'connected');
});