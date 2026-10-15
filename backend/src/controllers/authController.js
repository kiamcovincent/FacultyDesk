const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_MS,
  getAuthCookieOptions,
  getJwtSecret,
} = require('../config/auth');

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    department: user.department ? user.department.toString() : null,
  };
}

function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, getJwtSecret(), {
    expiresIn: Math.floor(SESSION_DURATION_MS / 1000),
  });

  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

function respondWithError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: 'teacher' });

    setAuthCookie(res, user);
    return res.status(201).json({ message: 'Registration successful.', user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return respondWithError(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }

    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email }).select('+passwordHash');

    if (!user || user.status !== 'active' || !(await user.comparePassword(req.body.password))) {
      return respondWithError(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    setAuthCookie(res, user);
    return res.status(200).json({ message: 'Login successful.', user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  const { httpOnly, secure, sameSite, path } = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly, secure, sameSite, path });
  return res.status(200).json({ message: 'Logged out successfully.' });
}

function getProfile(req, res) {
  return res.status(200).json({ user: serializeUser(req.user) });
}

module.exports = { register, login, logout, getProfile };
