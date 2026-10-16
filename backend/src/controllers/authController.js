const supabaseAuthService = require('../services/supabaseAuthService');
const { createAuthIdentityService } = require('../services/authIdentityService');
const {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_MS,
  getAuthCookieOptions,
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

function respondWithError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function clearAuthCookie(res) {
  const { httpOnly, secure, sameSite, path } = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly, secure, sameSite, path });
}

function setAuthCookie(res, session) {
  if (!session?.access_token) {
    throw new Error('Supabase did not return an access token.');
  }

  const expiresInMs = Number(session.expires_in) * 1000;
  const maxAge = Number.isFinite(expiresInMs) && expiresInMs > 0
    ? Math.min(expiresInMs, SESSION_DURATION_MS)
    : SESSION_DURATION_MS;

  res.cookie(AUTH_COOKIE_NAME, session.access_token, {
    ...getAuthCookieOptions(),
    maxAge,
  });
}

function isEmailAlreadyRegistered(error) {
  return ['user_already_exists', 'email_exists'].includes(error.code)
    || (error.status === 422 && /already (been )?registered|already exists/i.test(error.message || ''));
}

function isEmailUnconfirmed(error) {
  return error.code === 'email_not_confirmed'
    || /email not confirmed/i.test(error.message || '');
}

function createAuthController({
  authService = supabaseAuthService,
  identityService = createAuthIdentityService(),
} = {}) {
  async function register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const data = await authService.registerWithSupabase({ name, email, password });
      const confirmation = authService.getRegistrationConfirmation(data);

      if (confirmation.confirmationRequired) {
        return res.status(201).json({
          message: 'Registration successful. Check your email to confirm your account.',
          confirmationRequired: true,
          email: confirmation.email || email.trim().toLowerCase(),
        });
      }

      const user = await identityService.resolveAuthenticatedUser(data.user, password);
      setAuthCookie(res, data.session);
      return res.status(201).json({ message: 'Registration successful.', user: serializeUser(user) });
    } catch (error) {
      if (isEmailAlreadyRegistered(error)) {
        return respondWithError(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.');
      }

      return next(error);
    }
  }

  async function login(req, res, next) {
    try {
      const { email, password } = req.body;
      const data = await authService.loginWithSupabase({ email, password });

      if (!data.session) {
        return respondWithError(res, 403, 'EMAIL_NOT_CONFIRMED', 'Confirm your email before signing in.');
      }

      const user = await identityService.resolveAuthenticatedUser(data.user, password);
      setAuthCookie(res, data.session);
      return res.status(200).json({ message: 'Login successful.', user: serializeUser(user) });
    } catch (error) {
      if (isEmailUnconfirmed(error)) {
        return respondWithError(res, 403, 'EMAIL_NOT_CONFIRMED', 'Confirm your email before signing in.');
      }

      if (error.status === 400 || error.status === 401) {
        return respondWithError(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }

      return next(error);
    }
  }

  async function logout(req, res, next) {
    const accessToken = req.cookies?.[AUTH_COOKIE_NAME];

    try {
      if (accessToken) await authService.logoutFromSupabase(accessToken);
    } catch (error) {
      clearAuthCookie(res);
      return next(error);
    }

    clearAuthCookie(res);
    return res.status(200).json({ message: 'Logged out successfully.' });
  }

  function getProfile(req, res) {
    return res.status(200).json({ user: serializeUser(req.user) });
  }

  return { register, login, logout, getProfile };
}

module.exports = { ...createAuthController(), createAuthController };