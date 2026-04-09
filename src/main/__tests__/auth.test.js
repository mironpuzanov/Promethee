import { beforeEach, describe, expect, it, vi } from 'vitest';

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
