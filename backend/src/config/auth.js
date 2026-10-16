const AUTH_COOKIE_NAME = 'facultyDeskAuth';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }

  return secret;
}

function getAuthCookieOptions() {
  const sameSite = process.env.AUTH_COOKIE_SAME_SITE || 'lax';

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/',
    maxAge: SESSION_DURATION_MS,
  };
}

module.exports = {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_MS,
  getAuthCookieOptions,
  getJwtSecret,
};
