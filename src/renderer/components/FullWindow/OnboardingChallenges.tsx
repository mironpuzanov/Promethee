import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface Challenge {
  id: string;
  icon: string;
  title: string;
  description: string;
  xp: number;
  done: boolean;
}

const LS_KEY = 'onboarding:leaderboard_visited';

async function loadChallenges(): Promise<Challenge[]> {
  const [tasksRes, habitsRes, profileRes] = await Promise.all([
    window.promethee.tasks.listAll().catch(() => ({ success: false, tasks: [] })),
    window.promethee.habits.list().catch(() => ({ success: false, habits: [] })),
    window.promethee.db.getUserProfile().catch(() => ({ success: false, profile: null })),
  ]);

  const tasks = (tasksRes as any).tasks || [];
  const habits = (habitsRes as any).habits || [];
  const profile = (profileRes as any).profile;
  // total_xp > 0 means at least one session was completed (XP is awarded on session end)
  const sessionsDone = (profile?.total_xp ?? 0) > 0;
  const leaderboardVisited = localStorage.getItem(LS_KEY) === '1';

  return [
    {
      id: 'session',
      icon: '⚡',
      title: 'Run a focus session',
      description: 'Start your first deep work session',
      xp: 50,
      done: sessionsDone,
    },
    {
      id: 'task',
      icon: '✅',
      title: 'Create a task',
      description: 'Add something you want to get done',
      xp: 50,
      done: tasks.length > 0,
    },
    {
      id: 'habit',
      icon: '🔥',
      title: 'Build a habit',
      description: 'Set up a habit to track daily',
      xp: 50,
      done: habits.length > 0,
    },
    {
      id: 'leaderboard',
      icon: '🏆',
      title: 'Check the leaderboard',
      description: 'See how you rank this week',
      xp: 50,
      done: leaderboardVisited,
    },
  ];
}

export function markLeaderboardVisited() {
  localStorage.setItem(LS_KEY, '1');
}

export default function OnboardingChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('onboarding:challenges_dismissed') === '1'
  );

  useEffect(() => {
    loadChallenges().then((cs) => {
      setChallenges(cs);
      setAllDone(cs.every((c) => c.done));
    });
  }, []);

  // Re-check every time window gains focus (user may have done something)
  useEffect(() => {
    const handler = () => {
      loadChallenges().then((cs) => {
        setChallenges(cs);
        setAllDone(cs.every((c) => c.done));
      });
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const completedCount = challenges.filter((c) => c.done).length;

  // Hide if dismissed or all 4 done for >1 day (give them 1 refresh to see all green)
  if (dismissed) return null;

  return (
    <AnimatePresence>
      {challenges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          style={{ paddingLeft: 40, paddingRight: 40, flexShrink: 0 }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                Challenges
              </span>
              {/* Progress pill */}
              <span style={{
                fontSize: 10, fontWeight: 600,
                background: allDone ? 'rgba(34,197,94,0.15)' : 'var(--accent)',
                color: allDone ? '#22c55e' : 'var(--text-secondary)',
                borderRadius: 99, padding: '2px 8px',
              }}>
                {completedCount}/4
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('onboarding:challenges_dismissed', '1');
                setDismissed(true);
              }}
              style={{
                fontSize: 11, color: 'var(--text-muted)', background: 'none',
                border: 'none', cursor: 'pointer', padding: '2px 4px',
              }}
            >
              Dismiss
            </button>
          </div>

          {/* Cards row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {challenges.map((c) => (
              <div
                key={c.id}
                style={{
                  background: c.done ? 'rgba(34,197,94,0.06)' : 'var(--surface)',
                  border: `1px solid ${c.done ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '12px 12px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'border-color 0.3s, background 0.3s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* XP badge */}
                <span style={{
                  alignSelf: 'flex-start',
                  fontSize: 9, fontWeight: 700,
                  background: c.done ? 'rgba(34,197,94,0.15)' : 'rgba(232,146,42,0.12)',
                  color: c.done ? '#22c55e' : 'var(--accent-fire)',
                  borderRadius: 6, padding: '2px 6px',
                  letterSpacing: '0.06em',
                }}>
                  {c.done ? '✓' : '+'}{c.xp} XP
                </span>

                {/* Title */}
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: c.done ? 'var(--text-secondary)' : 'var(--foreground)', lineHeight: 1.3 }}>
                  {c.title}
                </p>

                {/* Description */}
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {c.description}
                </p>

                {/* Bottom: icon + state */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
                  {c.done ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#22c55e', fontWeight: 600 }}>
                      <Check size={12} strokeWidth={2.5} /> Done
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0 / 1</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
