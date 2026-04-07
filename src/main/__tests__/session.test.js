import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startSession, endSessionAndSync, resetSessionForTesting } from '../session.js';
import * as db from '../db.js';

const insertMock = vi.fn().mockResolvedValue({ error: null });
const eqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: eqMock }));

vi.mock('../db.js');
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'sessions') return { insert: insertMock };
      if (table === 'user_profile') return { update: updateMock };
      return {};
    }),
  },
}));

describe('Session Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionForTesting();

    db.endSession = vi.fn();
    db.updateUserXP = vi.fn();
    db.markSessionSynced = vi.fn();
    db.updateStreak = vi.fn().mockReturnValue(0);
    db.getUserProfile = vi.fn().mockReturnValue({
      total_xp: 0,
      level: 1,
      current_streak: 0,
      last_session_date: '2026-04-07',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startSession creates a SQLite record', () => {
    const mockSession = {
      id: 'session_123',
      userId: 'user_1',
      task: 'Test task',
      startedAt: Date.now(),
    };

    db.createSession = vi.fn().mockReturnValue(mockSession);

    const session = startSession('user_1', 'Test task');

    expect(db.createSession).toHaveBeenCalledWith('user_1', 'Test task');
    expect(session).toEqual(mockSession);
  });

  it('endSession awards 10 XP per minute and syncs the result', async () => {
    const startTime = 1_000_000;
    db.createSession = vi.fn().mockReturnValue({
      id: 'session_123',
      userId: 'user_1',
      task: 'Test task',
      startedAt: startTime,
    });
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 120_000);

    startSession('user_1', 'Test task');
    const ended = await endSessionAndSync();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ended.durationSeconds).toBe(120);
    expect(ended.baseXp).toBe(20);
    expect(ended.xpEarned).toBe(20);
    expect(db.endSession).toHaveBeenCalledWith('session_123', 20, 120);
    expect(db.updateUserXP).toHaveBeenCalledWith('user_1', 20);
    expect(insertMock).toHaveBeenCalled();
    expect(db.markSessionSynced).toHaveBeenCalledWith('session_123');
  });

  it('endSession applies streak and depth bonuses', async () => {
    const startTime = 1_000_000;
    db.createSession = vi.fn().mockReturnValue({
      id: 'session_456',
      userId: 'user_1',
      task: 'Deep work',
      startedAt: startTime,
    });
    db.updateStreak = vi.fn().mockReturnValue(5);
    db.getUserProfile = vi.fn().mockReturnValue({
      total_xp: 2250,
      level: 6,
      current_streak: 5,
      last_session_date: '2026-04-07',
    });
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 7_200_000);

    startSession('user_1', 'Deep work');
    const ended = await endSessionAndSync();

    expect(ended.durationSeconds).toBe(7200);
    expect(ended.baseXp).toBe(1200);
    expect(ended.multiplier).toBe(1.875);
    expect(ended.xpEarned).toBe(2250);
    expect(ended.streakBonus).toBe(0.5);
    expect(ended.depthBonus).toBe(0.25);
  });

  it('endSession with duration under 60s earns 0 XP', async () => {
    const startTime = 1_000_000;
    db.createSession = vi.fn().mockReturnValue({
      id: 'session_789',
      userId: 'user_1',
      task: 'Quick test',
      startedAt: startTime,
    });
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 45_000);

    startSession('user_1', 'Quick test');
    const ended = await endSessionAndSync();

    expect(ended.durationSeconds).toBe(45);
    expect(ended.baseXp).toBe(0);
    expect(ended.xpEarned).toBe(0);
  });

  it('startSession when a session is already active rejects', () => {
    const mockSession = {
      id: 'session_123',
      userId: 'user_1',
      task: 'First task',
      startedAt: Date.now(),
    };

    db.createSession = vi.fn().mockReturnValue(mockSession);

    startSession('user_1', 'First task');

    expect(() => {
      startSession('user_1', 'Second task');
    }).toThrow('A session is already active');
  });
});
