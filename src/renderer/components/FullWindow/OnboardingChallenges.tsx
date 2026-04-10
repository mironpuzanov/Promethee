import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface Challenge {
  id: string;
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
  const sessionsDone = (profile?.total_xp ?? 0) > 0;
  const leaderboardVisited = localStorage.getItem(LS_KEY) === '1';

  return [
    {
      id: 'session',
      title: 'Run a focus session',
      description: 'Start your first deep work session',
      xp: 50,
      done: sessionsDone,
    },
    {
      id: 'task',
      title: 'Create a task',
      description: 'Add something you want to get done',
      xp: 50,
      done: tasks.length > 0,
    },
    {
      id: 'habit',
      title: 'Build a habit',
      description: 'Set up a habit to track daily',
      xp: 50,
      done: habits.length > 0,
    },
    {
      id: 'leaderboard',
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

interface ChallengeCardProps {
  challenge: Challenge;
}

function ChallengeCard({ challenge }: ChallengeCardProps) {
  const { title, description, xp, done } = challenge;
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '12px 12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'border-color 0.3s',
      }}
    >
      {/* XP badge */}
      <span style={{
        alignSelf: 'flex-start',
        fontSize: 9,
        fontWeight: 700,
        background: 'rgba(232,146,42,0.12)',
        color: 'var(--accent-fire)',
        borderRadius: 6,
        padding: '2px 6px',
        letterSpacing: '0.06em',
      }}>
        {done ? '✓' : '+'}{xp} XP
      </span>

      {/* Title */}
      <p style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 600,
        color: done ? 'var(--text-secondary)' : 'var(--foreground)',
        lineHeight: 1.3,
      }}>
        {title}
      </p>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: 10,
        color: 'var(--text-muted)',
        lineHeight: 1.45,
        flex: 1,
      }}>
        {description}
      </p>

      {/* Bottom status */}
      <div style={{ marginTop: 6 }}>
        {done ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            fontWeight: 700,
            color: '#4ade80',
            letterSpacing: '0.02em',
          }}>
            <Check size={11} strokeWidth={2.5} />
            Done
          </span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0 / 1</span>
        )}
      </div>
    </div>
  );
}

export default function OnboardingChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('onboarding:challenges_dismissed') === '1'
  );

  useEffect(() => {
    loadChallenges().then(setChallenges);
  }, []);

  useEffect(() => {
    const handler = () => loadChallenges().then(setChallenges);
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const completedCount = challenges.filter((c) => c.done).length;

  if (dismissed || challenges.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        style={{ paddingLeft: 40, paddingRight: 40, flexShrink: 0 }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--text-muted)',
            }}>
              Challenges
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: 99,
              padding: '1px 7px',
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
              fontSize: 11,
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            Dismiss
          </button>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
