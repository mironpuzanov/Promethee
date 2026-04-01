import { supabase } from '../lib/supabase.js';
import keytar from 'keytar';
import { createOrUpdateUserProfile } from './db.js';

const SERVICE_NAME = 'Promethee';
const ACCOUNT_NAME = 'session_token';

let currentUser = null;

// Create a mock user for testing (bypass auth)
function createMockUser() {
  return {
    id: 'test_user_' + Date.now(),
    email: 'test@promethee.dev',
    user_metadata: {
      display_name: 'Test User'
    }
  };
}

export async function signIn(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'promethee://auth/callback'
    }
  });

  if (error) {
    throw error;
  }

  return { success: true, message: 'Check your email for the magic link' };
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

  // FOR TESTING: Use mock user if no real auth
  // Remove this in production
  console.log('Creating mock user for testing...');
  currentUser = createMockUser();

  // Update local database with mock user
  createOrUpdateUserProfile(
    currentUser.id,
    currentUser.email,
    currentUser.user_metadata?.display_name || currentUser.email
  );

  return currentUser;

  /* PRODUCTION AUTH CODE - commented out for testing
  // Try to restore session from keychain
  const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

  if (token) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: token
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        currentUser = data.user;

        // Update local database
        createOrUpdateUserProfile(
          data.user.id,
          data.user.email,
          data.user.user_metadata?.display_name || data.user.email
        );

        return currentUser;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    }
  }

  return null;
  */
}

export async function setSession(accessToken, refreshToken) {
  // Store in keychain
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, accessToken);

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    currentUser = data.user;

    // Update local database
    createOrUpdateUserProfile(
      data.user.id,
      data.user.email,
      data.user.user_metadata?.display_name || data.user.email
    );

    return currentUser;
  }

  return null;
}

export function getCurrentUser() {
  return currentUser;
}
