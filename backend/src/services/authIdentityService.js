const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function identityError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isEmailConfirmed(authUser) {
  return Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
}

function createAuthIdentityService({
  UserModel = User,
  bcryptModule = bcrypt,
  randomBytes = crypto.randomBytes,
} = {}) {
  function findBySupabaseId(authUserId) {
    return UserModel.findOne({ supabaseUserId: authUserId })
      .select('_id name email role status department +supabaseUserId');
  }

  function requireActive(user) {
    if (!user) {
      throw identityError(401, 'ACCOUNT_LINK_REQUIRED', 'This account is not linked to a FacultyDesk profile.');
    }

    if (user.status !== 'active') {
      throw identityError(403, 'ACCOUNT_INACTIVE', 'This account is inactive. Contact an administrator.');
    }

    return user;
  }

  async function getMappedUser(authUserId) {
    return requireActive(await findBySupabaseId(authUserId));
  }

  async function resolveAuthenticatedUser(authUser, password) {
    if (!authUser?.id || !authUser.email || !isEmailConfirmed(authUser)) {
      throw identityError(403, 'EMAIL_NOT_CONFIRMED', 'Confirm your email before signing in.');
    }

    const linkedUser = await findBySupabaseId(authUser.id);
    if (linkedUser) return requireActive(linkedUser);

    const email = authUser.email.trim().toLowerCase();
    const legacyUser = await UserModel.findOne({ email }).select('+passwordHash +supabaseUserId');

    if (legacyUser) {
      requireActive(legacyUser);
      if (legacyUser.supabaseUserId && legacyUser.supabaseUserId !== authUser.id) {
        throw identityError(
          409,
          'ACCOUNT_LINK_CONFLICT',
          'This account is already linked to a different sign-in.'
        );
      }

      const passwordMatches = password
        && legacyUser.passwordHash
        && await legacyUser.comparePassword(password);

      if (!passwordMatches) {
        throw identityError(
          409,
          'ACCOUNT_LINK_REQUIRED',
          'This existing account needs a verified link. Sign in with its existing password or contact an administrator.'
        );
      }

      legacyUser.supabaseUserId = authUser.id;
      try {
        await legacyUser.save();
      } catch (error) {
        if (error.code !== 11000) throw error;
        const concurrentLink = await findBySupabaseId(authUser.id);
        if (concurrentLink?._id?.toString() === legacyUser._id.toString()) {
          return requireActive(concurrentLink);
        }
        throw identityError(409, 'ACCOUNT_LINK_CONFLICT', 'This account is already linked to another sign-in.');
      }

      return legacyUser;
    }

    const name = authUser.user_metadata?.name?.trim();
    if (!name || name.length < 2 || name.length > 100) {
      throw identityError(409, 'PROFILE_REQUIRED', 'A valid name is required to create your teacher profile.');
    }

    try {
      return await UserModel.create({
        name,
        email,
        passwordHash: await bcryptModule.hash(randomBytes(32).toString('hex'), 12),
        role: 'teacher',
        status: 'active',
        supabaseUserId: authUser.id,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const concurrentLink = await findBySupabaseId(authUser.id);
      if (concurrentLink) return requireActive(concurrentLink);
      throw identityError(409, 'ACCOUNT_LINK_CONFLICT', 'This account could not be linked safely.');
    }
  }

  return { getMappedUser, resolveAuthenticatedUser };
}

module.exports = { createAuthIdentityService, identityError };