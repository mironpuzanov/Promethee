import { supabase } from '../lib/supabase.js';
import keytar from 'keytar';
import { createOrUpdateUserProfile } from './db.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const debugLog = (msg) => {
  const logPath = '/tmp/promethee-debug.log';
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `${timestamp} - [auth] ${msg}\n`);
  console.log(`[auth] ${msg}`);
};

const SERVICE_NAME = 'Promethee';
const ACCOUNT_NAME = 'session_tokens';

// Non-secret flag file — presence means "keychain likely has tokens, show restore button"
// Written on every successful setSession, deleted on signOut.
function hasSessionFlagPath() {
  return path.join(app.getPath('userData'), 'has-session.json');
}

export function hasStoredSession() {
  try {
    return fs.existsSync(hasSessionFlagPath());
  } catch {
    return false;
  }
}

function writeSessionFlag() {
  try {
    fs.writeFileSync(hasSessionFlagPath(), JSON.stringify({ ts: Date.now() }));
  } catch { /* non-fatal */ }
}

function deleteSessionFlag() {
  try {
    fs.unlinkSync(hasSessionFlagPath());
  } catch { /* already gone */ }
}

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

  // Clear keychain and session flag
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  deleteSessionFlag();

  currentUser = null;
  return { success: true };
}

export async function getUser() {
  if (currentUser) {
    return currentUser;
  }

  // Skip keychain entirely if the flag file is absent — new install, nothing stored.
  // This prevents the macOS keychain dialog from firing against a blank screen.
  if (!hasStoredSession()) {
    debugLog('No has-session flag — skipping keychain read (new install)');
    return null;
  }

  // Try to restore session from keychain
  const stored = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

  if (stored) {
    try {
      const { access_token, refresh_token } = JSON.parse(stored);
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token
        });

        if (error) {
          // Only wipe the keychain for genuine auth rejections (invalid/expired token).
          // Network failures, DNS errors, and timeouts should NOT delete the stored
          // tokens — the user is still authenticated, just temporarily offline.
          const isAuthRejection = error.status === 400 || error.status === 401
            || error.message?.toLowerCase().includes('invalid')
            || error.message?.toLowerCase().includes('expired')
            || error.message?.toLowerCase().includes('not found');
          if (isAuthRejection) {
            debugLog(`Session restore: auth rejection (${error.status} ${error.message}) — clearing keychain`);
            await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
            deleteSessionFlag();
          } else {
            debugLog(`Session restore: transient error (${error.status} ${error.message}) — keeping keychain`);
          }
          return null;
        }

        if (data.user) {
          currentUser = data.user;
          // If Supabase refreshed the token, persist the new one back to keychain
          if (data.session?.access_token && data.session.access_token !== access_token) {
            debugLog('Session token was refreshed — updating keychain');
            await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token || refresh_token,
            }));
          }
          const displayName = data.user.user_metadata?.display_name || data.user.email;
          createOrUpdateUserProfile(data.user.id, data.user.email, displayName);
          // Ensure Supabase profile exists (needed for FK on sessions table).
          // Run in background — a failure here must NOT wipe the session.
          syncUserProfileToSupabase(data.user.id, data.user.email, displayName).catch((e) => {
            debugLog(`syncUserProfileToSupabase failed (non-fatal): ${e.message}`);
          });
          return currentUser;
        }
      } catch (err) {
        debugLog(`Session restore threw transient error (${err?.message || err}) — keeping keychain`);
        return null;
      }
    } catch (err) {
      // JSON parse error or similar — the stored value is corrupted, safe to delete.
      console.error('Failed to parse stored session:', err);
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      deleteSessionFlag();
    }
  }

  return null;
}

export async function getAccessToken() {
  // getSession() returns the current in-memory token and auto-refreshes if expired.
  // This is the authoritative source — always up to date.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    // Session gone — try restoring from keychain once
    const stored = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!stored) return null;
    try {
      const { access_token, refresh_token } = JSON.parse(stored);
      const { data: refreshed } = await supabase.auth.setSession({ access_token, refresh_token });
      return refreshed?.session?.access_token || null;
    } catch {
      return null;
    }
  }
  return data.session.access_token;
}

export async function setSession(accessToken, refreshToken) {
  // Persist both tokens to keychain as JSON
  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken
    }));
    writeSessionFlag(); // mark that keychain has tokens — used to skip cold-start dialog
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

async function syncUserProfileToSupabase(userId, email, displayName, avatarUrl) {
  try {
    const row = { id: userId, email, display_name: displayName };
    if (avatarUrl !== undefined) row.avatar_url = avatarUrl;
    const { error } = await supabase
      .from('user_profile')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: false });
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

export async function updateProfile({ displayName, avatarUrl }) {
  const updates = {};
  if (displayName !== undefined) updates.display_name = displayName;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

  const { data, error } = await supabase.auth.updateUser({ data: updates });
  if (error) throw error;

  if (data.user) {
    currentUser = data.user;
    const dn = data.user.user_metadata?.display_name || data.user.email;
    const av = data.user.user_metadata?.avatar_url;
    createOrUpdateUserProfile(data.user.id, data.user.email, dn);
    await syncUserProfileToSupabase(data.user.id, data.user.email, dn, av);
  }
  return { success: true, user: data.user };
}

export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return { success: true };
}

export async function uploadAvatar(fileBuffer, mimeType) {
  if (!currentUser) throw new Error('Not authenticated');

  const userId = currentUser.id;
  // Use the user ID as the filename so each user has exactly one avatar
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const filePath = `${userId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const avatarUrl = urlData.publicUrl;

  // Save the URL to user metadata + user_profile table
  return updateProfile({ avatarUrl });
}
