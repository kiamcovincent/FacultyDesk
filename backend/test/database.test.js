const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const dotenv = require('dotenv');

dotenv.config();

const { connectDB } = require('../src/config/db');
const app = require('../src/app');
const testMongoUri = 'mongodb://127.0.0.1:27017/teacher_attendance_connection_test';

test('health reports database failure and recovers after reconnect', async () => {
  const configuredMongoUri = process.env.MONGO_URI;

  try {
    await mongoose.disconnect();
    process.env.MONGO_URI = 'mongodb://127.0.0.1:1/facultydesk_unavailable';

    await assert.rejects(connectDB(), /MongoDB connection failed/);
    const unavailableHealth = await request(app).get('/api/health');
    assert.equal(unavailableHealth.status, 503);
    assert.equal(unavailableHealth.body.error.code, 'DATABASE_UNAVAILABLE');

    process.env.MONGO_URI = testMongoUri;
    await connectDB();
    const recoveredHealth = await request(app).get('/api/health');
    assert.equal(recoveredHealth.status, 200);
    assert.equal(recoveredHealth.body.database, 'connected');
  } finally {
    await mongoose.disconnect();
    process.env.MONGO_URI = configuredMongoUri;
  }
});
