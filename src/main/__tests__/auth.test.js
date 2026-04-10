import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

const TEST_USER_DATA = '/tmp/promethee-test-auth';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => TEST_USER_DATA),
    getVersion: vi.fn(() => '1.1.8'),
  },
}));

const keytarState = {
  stored: null,
};

const setSessionMock = vi.fn();
const deletePasswordMock = vi.fn(async () => {
  keytarState.stored = null;
});
const getPasswordMock = vi.fn(async () => keytarState.stored);
const setPasswordMock = vi.fn(async () => {});

vi.mock('keytar', () => ({
  default: {
    getPassword: getPasswordMock,
    deletePassword: deletePasswordMock,
    setPassword: setPasswordMock,
  },
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      setSession: setSessionMock,
    },
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock('../db.js', () => ({
  createOrUpdateUserProfile: vi.fn(),
}));

describe('auth.getUser', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    keytarState.stored = JSON.stringify({
      access_token: 'access',
      refresh_token: 'refresh',
    });
    fs.mkdirSync(TEST_USER_DATA, { recursive: true });
    fs.writeFileSync(`${TEST_USER_DATA}/has-session.json`, JSON.stringify({ ts: Date.now() }));
  });

  afterEach(() => {
    try { fs.rmSync(TEST_USER_DATA, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('keeps the keychain when session restore throws a transient network error', async () => {
    setSessionMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const { getUser } = await import('../auth.js');

    const user = await getUser();

    expect(user).toBeNull();
    expect(deletePasswordMock).not.toHaveBeenCalled();
    expect(getPasswordMock).toHaveBeenCalled();
  });

  it('deletes the keychain when the stored session JSON is corrupted', async () => {
    keytarState.stored = '{bad json';
    const { getUser } = await import('../auth.js');

    const user = await getUser();

    expect(user).toBeNull();
    expect(deletePasswordMock).toHaveBeenCalledTimes(1);
  });
});
