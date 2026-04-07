import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain } from 'lucide-react';
import { getLevelInfo } from '../../../lib/xp';
import homeBg from '../../../assets/home-bg.png';
import './CharacterPanel.css';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string };
}

interface UserProfile {
  total_xp: number;
  level: number;
  display_name?: string;
  current_streak?: number;
}

interface SkillScores {
  rigueur: number;
  volonte: number;
  courage: number;
}

interface SkillsRaw {
  totalMinutes: number;
  streak: number;
  deepSessions: number;
  sessionCount?: number;
}

interface MemorySnap {
  behavioral_summary?: string | null;
  emotional_tags?: string[] | null;
}

interface DailySignal {
  content: string;
  intensity: 'low' | 'med' | 'high';
  date: string;
}

interface CharacterPanelProps {
  user: User | null;
  onOpenMemory?: () => void;
}

function truncateText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } },
};

// Intensity uses semantic colors: low=indigo(calm), med=fire(active), high=destructive(surge)
const INTENSITY_STYLE: Record<DailySignal['intensity'], { dot: string; border: string }> = {
  low:  { dot: 'rgba(99,102,241,0.9)',        border: 'rgba(99,102,241,0.2)' },
  med:  { dot: 'var(--accent-fire)',           border: 'var(--border-accent)' },
  high: { dot: 'var(--destructive)',           border: 'rgba(239,68,68,0.25)' },
};

function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ width: 80, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: 'var(--accent-fire)', borderRadius: 2 }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function CharacterPanel({ user, onOpenMemory }: CharacterPanelProps) {
  const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';
  const [profile, setProfile] = useState<UserProfile>({ total_xp: 0, level: 1 });
  const [skills, setSkills] = useState<SkillScores | null>(null);
  const [skillsRaw, setSkillsRaw] = useState<SkillsRaw | null>(null);
  const [memoryTeaser, setMemoryTeaser] = useState<string | null>(null);
  const [memoryHasSnapshots, setMemoryHasSnapshots] = useState(false);
  const [signal, setSignal] = useState<DailySignal | null>(null);
  const [signalDismissed, setSignalDismissed] = useState(false);

  useEffect(() => {
    window.promethee.db.getUserProfile().then((result: { success: boolean; profile?: UserProfile }) => {
      if (result.success && result.profile) {
        setProfile(result.profile);
      }
    });

    window.promethee.skills.get().then((result) => {
      if (result.success && result.skills) {
        setSkills(result.skills);
        if (result.raw) setSkillsRaw(result.raw as SkillsRaw);
      }
    });

    window.promethee.memory.get().then((result: { success: boolean; snapshots?: MemorySnap[] }) => {
      if (!result.success) return;
      const snaps = result.snapshots || [];
      setMemoryHasSnapshots(snaps.length > 0);
      const withSummary = snaps.find((s) => s.behavioral_summary?.trim());
      if (withSummary?.behavioral_summary) {
        setMemoryTeaser(truncateText(withSummary.behavioral_summary, 220));
        return;
      }
      const withTags = snaps.find((s) => (s.emotional_tags?.length ?? 0) > 0);
      const tags = withTags?.emotional_tags;
      if (tags?.length) {
        setMemoryTeaser(`Recent tags: ${tags.slice(0, 5).join(', ')}`);
        return;
      }
      setMemoryTeaser(null);
    });

    window.promethee.signal.getToday().then((result) => {
      if (result.success && result.signal) {
        const s = result.signal;
        setSignal(s);
        if (localStorage.getItem(`dismissDailySignal:${s.date}`) === '1') {
          setSignalDismissed(true);
        }
      }
    });

    const unsub = window.promethee.signal.onNew((data) => {
      setSignal(data);
      setSignalDismissed(localStorage.getItem(`dismissDailySignal:${data.date}`) === '1');
    });
    return unsub;
  }, []);

  const levelInfo = getLevelInfo(profile.total_xp || 0);
  const { level, tier, totalXP, xpIntoLevel, xpForCurrentLevel, progress: xpProgress } = levelInfo;

  return (
    <motion.main
      className="flex flex-col bg-background overflow-y-auto gap-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero header — image with stats overlaid */}
      <motion.div
        variants={itemVariants}
        style={{
          position: 'relative',
          height: 220,
          flexShrink: 0,
          overflow: 'hidden',
          backgroundImage: `url(${homeBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
        }}
      >
        {/* Gradient: transparent top, dark bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)',
        }} />

        {/* Stats overlaid at bottom-left */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 40px 20px',
          color: 'var(--foreground)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em' }}>{userName}</h1>
            <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-secondary)' }}>
              Level {level} · {tier}
              {(profile.current_streak || 0) > 0 && (
                <span style={{ marginLeft: 8 }}>· {profile.current_streak}d streak</span>
              )}
            </p>
          </div>

          {/* XP progress bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
              <span>Progress to Level {level + 1}</span>
              <span>{xpIntoLevel} / {xpForCurrentLevel} XP</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'var(--accent-fire)', borderRadius: 2 }}
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{totalXP} XP total</span>
          </div>
        </div>
      </motion.div>

      {/* Daily Signal */}
      <AnimatePresence>
        {signal && !signalDismissed && (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            style={{ paddingLeft: 40, paddingRight: 40 }}
          >
            <div style={{
              position: 'relative',
              background: 'var(--surface)',
              border: `1px solid ${INTENSITY_STYLE[signal.intensity].border}`,
              borderRadius: 12,
              padding: '14px 40px 14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <button
                type="button"
                aria-label="Dismiss today’s note"
                onClick={() => {
                  localStorage.setItem(`dismissDailySignal:${signal.date}`, '1');
                  setSignalDismissed(true);
                }}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  padding: 0,
                  border: 'none',
                  borderRadius: 6,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                className="daily-signal-close"
              >
                <X size={16} strokeWidth={2} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: INTENSITY_STYLE[signal.intensity].dot,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Promethee · Today
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'normal' }}>
                {signal.content}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory preview (Supabase snapshots — same source as Memory tab) */}
      <motion.div variants={itemVariants} className="px-10">
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
            <Brain size={16} strokeWidth={1.75} />
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>Memory</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {memoryTeaser
              ? memoryTeaser
              : memoryHasSnapshots
                ? 'Open Memory for your full behavioral profile and charts.'
                : 'Promethee saves a short behavioral snapshot when you use the app. After your first snapshot, a preview will show up here.'}
          </p>
          {onOpenMemory && (
            <button
              type="button"
              onClick={onOpenMemory}
              className="character-panel-memory-btn"
            >
              Open Memory
            </button>
          )}
        </div>
      </motion.div>

      {/* Focus stats (local sessions, last 30d — matches Session log) */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1 px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground pb-1">Focus stats</p>
        <p className="text-xs text-muted-foreground pb-2" style={{ margin: 0, lineHeight: 1.45 }}>
          {skillsRaw
            ? `Last 30 days on this device: ${skillsRaw.sessionCount != null ? skillsRaw.sessionCount : '—'} sessions · ${skillsRaw.totalMinutes ?? 0} min focused · ${skillsRaw.deepSessions ?? 0} deep (≥2h) · ${skillsRaw.streak ?? 0}d streak`
            : 'Loading…'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <SkillBar label="Consistency" value={skills?.rigueur ?? 0} />
          <SkillBar label="Willpower" value={skills?.volonte ?? 0} />
          <SkillBar label="Deep runs" value={skills?.courage ?? 0} />
        </div>
        <p className="text-xs text-muted-foreground pt-1" style={{ margin: 0, opacity: 0.85 }}>
          Bars scale to caps: 3000 min · 30-day streak · 20 long sessions — so early numbers stay small until you rack up volume.
        </p>
      </motion.div>

      {/* Streak info */}
      {(profile.current_streak || 0) > 1 && (
        <motion.div variants={itemVariants} className="px-10 pb-10">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            background: 'var(--accent-glow)',
            border: '1px solid var(--border-accent)',
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {profile.current_streak}-day streak
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                XP multiplier active · +{Math.min((profile.current_streak ?? 0) * 10, 50)}%
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.main>
  );
}

export default CharacterPanel;
