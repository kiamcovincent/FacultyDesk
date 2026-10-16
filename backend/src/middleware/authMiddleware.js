const supabaseAuthService = require('../services/supabaseAuthService');
const { createAuthIdentityService } = require('../services/authIdentityService');
const { AUTH_COOKIE_NAME } = require('../config/auth');

function authError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function isEmailConfirmed(authUser) {
  return Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
}

function createAuthMiddleware({
  authService = supabaseAuthService,
  identityService = createAuthIdentityService(),
} = {}) {
  async function authenticate(req, res, next) {
    const accessToken = req.cookies?.[AUTH_COOKIE_NAME];

    if (!accessToken) {
      return authError(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    }

    let authUser;
    try {
      authUser = await authService.getSupabaseUser(accessToken);
    } catch (error) {
      if (error.status && error.status < 500) {
        return authError(res, 401, 'INVALID_SESSION', 'Your session is invalid or has expired.');
      }
      return next(error);
    }

    if (!isEmailConfirmed(authUser)) {
      return authError(res, 401, 'EMAIL_NOT_CONFIRMED', 'Confirm your email before using this account.');
    }

    try {
      req.user = await identityService.getMappedUser(authUser.id);
      req.authUser = authUser;
      return next();
    } catch (error) {
      if (error.statusCode) {
        return authError(res, error.statusCode, error.code, error.message);
      }
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

  return { authenticate, authorize };
}

module.exports = { ...createAuthMiddleware(), createAuthMiddleware };