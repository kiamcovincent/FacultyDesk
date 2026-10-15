const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AUTH_COOKIE_NAME, getJwtSecret } = require('../config/auth');

function authError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

async function authenticate(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return authError(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  let payload;

  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return authError(res, 401, 'INVALID_SESSION', 'Your session is invalid or has expired.');
    }

    return next(error);
  }

  try {
    const user = await User.findById(payload.sub).select('_id name email role status department');

    if (!user || user.status !== 'active') {
      return authError(res, 401, 'INVALID_SESSION', 'Your session is no longer active.');
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return authError(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return authError(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource.');
    }

    return next();
  };
}

module.exports = { authenticate, authorize };
