import { supabase } from '../lib/supabase.js';
import keytar from 'keytar';
import { createOrUpdateUserProfile } from './db.js';
import fs from 'fs';

const debugLog = (msg) => {
  const logPath = '/tmp/promethee-debug.log';
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `${timestamp} - [auth] ${msg}\n`);
  console.log(`[auth] ${msg}`);
};

const SERVICE_NAME = 'Promethee';
const ACCOUNT_NAME = 'session_tokens';

let currentUser = null;

export async function signIn(email, password) {
  debugLog(`signIn called for ${email}`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    debugLog(`signIn error: ${JSON.stringify(error)}`);
    throw error;
  }

  if (data.session) {
    const user = await setSession(data.session.access_token, data.session.refresh_token);
    return { success: true, user };
  }

  return { success: true };
}

export async function sendMagicLink(email) {
  debugLog(`sendMagicLink called for ${email}`);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'promethee://auth/callback',
      shouldCreateUser: true  // works for both existing and new OTP-only accounts
    }
  });
  if (error) {
    debugLog(`sendMagicLink error: ${JSON.stringify(error)}`);
    throw error;
  }
  return { success: true };
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'promethee://auth/callback'
    }
  });

  if (error) {
    throw error;
  }

  // If email confirmation is disabled in Supabase, user is immediately active
  if (data.session) {
    return { success: true, session: data.session, user: data.user, needsConfirmation: false };
  }

  return { success: true, needsConfirmation: true, message: 'Check your email to confirm your account' };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  // Clear keychain
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);

  currentUser = null;
  return { success: true };
}

export async function getUser() {
  if (currentUser) {
    return currentUser;
  }

  // Try to restore session from keychain
  const stored = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

  if (stored) {
    try {
      const { access_token, refresh_token } = JSON.parse(stored);
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token
      });

      if (error) {
        await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
        return null;
      }

      if (data.user) {
        currentUser = data.user;
        const displayName = data.user.user_metadata?.display_name || data.user.email;
        createOrUpdateUserProfile(data.user.id, data.user.email, displayName);
        // Ensure Supabase profile exists (needed for FK on sessions table)
        await syncUserProfileToSupabase(data.user.id, data.user.email, displayName);
        return currentUser;
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    }
  }

  return null;
}

export async function setSession(accessToken, refreshToken) {
  // Persist both tokens to keychain as JSON
  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken
    }));
    debugLog('Session saved to keychain successfully');
  } catch (keychainErr) {
    debugLog(`KEYCHAIN SAVE FAILED: ${keychainErr.message}`);
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    debugLog(`setSession Supabase error: ${JSON.stringify(error)}`);
    throw error;
  }

  if (data.user) {
    currentUser = data.user;
    const displayName = data.user.user_metadata?.display_name || data.user.email;
    debugLog(`setSession: user set to ${data.user.email}`);

    // Update local database
    createOrUpdateUserProfile(data.user.id, data.user.email, displayName);

    // Upsert into Supabase user_profile so sessions can sync (FK requires this row)
    await syncUserProfileToSupabase(data.user.id, data.user.email, displayName);

    return currentUser;
  }

  debugLog('setSession: no user in response');
  return null;
}

async function syncUserProfileToSupabase(userId, email, displayName) {
  try {
    const { error } = await supabase
      .from('user_profile')
      .upsert(
        { id: userId, email, display_name: displayName },
        { onConflict: 'id', ignoreDuplicates: false }
      );
    if (error) {
      console.error('Failed to sync user profile to Supabase:', error);
    }
  } catch (err) {
    console.error('syncUserProfileToSupabase threw:', err);
  }
}

export function getCurrentUser() {
  return currentUser;
}
