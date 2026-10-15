const dotenv = require('dotenv');
dotenv.config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 12 characters in backend/.env.');
  }

  await connectDB();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existingAdmin = await User.findOne({ email, role: 'admin' });

  if (existingAdmin) {
    console.log(`Administrator ${email} already exists; no changes made.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({
    name: ADMIN_NAME.trim(),
    email,
    passwordHash,
    role: 'admin',
    status: 'active',
  });

  console.log(`Administrator ${email} created successfully.`);
}

seedAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
