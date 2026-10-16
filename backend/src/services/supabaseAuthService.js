
const supabase = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');

function createAuthenticatedClient(accessToken) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function registerWithSupabase({ name, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        name: name.trim(),
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

function getRegistrationConfirmation(data) {
  const emailConfirmed = Boolean(data?.user?.email_confirmed_at || data?.user?.confirmed_at);

  return {
    confirmationRequired: Boolean(data?.user && (!data.session || !emailConfirmed)),
    ...(typeof data?.user?.email === 'string' ? { email: data.user.email } : {}),
  };
}

async function loginWithSupabase({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

async function getSupabaseUser(accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw error;
  }

  return data.user;
}

async function getTeacherProfile(accessToken) {
  const authUser = await getSupabaseUser(accessToken);
  const { data, error } = await createAuthenticatedClient(accessToken)
    .from('teachers')
    .select('id, auth_user_id, full_name, email, role, status')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function logoutFromSupabase(accessToken) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.msg || 'Supabase logout failed.');
  }
}

module.exports = {
  registerWithSupabase,
  getRegistrationConfirmation,
  loginWithSupabase,
  getSupabaseUser,
  getTeacherProfile,
  logoutFromSupabase,
};
