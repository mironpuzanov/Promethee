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
  snapshot_date?: string;
  behavioral_summary?: string | null;
  emotional_tags?: string[] | null;
  peak_hours?: string | null;
  session_count?: number | null;
  total_minutes?: number | null;
  streak_at_snapshot?: number | null;
}

interface DailySignal {
  content: string;
  intensity: 'low' | 'med' | 'high';
  date: string;
}

interface CharacterPanelProps {
  user: User | null;
}

function truncateText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

function buildMemoryTeaser(snapshot?: MemorySnap | null): string | null {
  if (!snapshot) return null;
  if (snapshot.behavioral_summary?.trim()) {
    return truncateText(snapshot.behavioral_summary, 220);
  }

  const parts: string[] = [];
  const minutes = snapshot.total_minutes || 0;
  const sessions = snapshot.session_count || 0;
  const streak = snapshot.streak_at_snapshot || 0;

  if (minutes > 0) parts.push(`${minutes}m focused`);
  if (sessions > 0) parts.push(`${sessions} session${sessions === 1 ? '' : 's'}`);
  if (snapshot.peak_hours) parts.push(`peak ${snapshot.peak_hours}`);
  if (streak > 0) parts.push(`${streak}d streak`);

  if (parts.length > 0) {
    return `Latest memory: ${parts.join(' · ')}.`;
  }

  const tags = snapshot.emotional_tags || [];
  if (tags.length > 0) {
    return `Recent tags: ${tags.slice(0, 5).join(', ')}`;
  }

  return null;
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

function formatSkillValue(label: 'Consistency' | 'Willpower' | 'Deep runs', raw?: SkillsRaw): string {
  if (!raw) return '—';
  if (label === 'Willpower') return `${raw.totalMinutes}m`;
  if (label === 'Consistency') return `${raw.streak}d`;
  return String(raw.deepSessions);
}

function TriangleChart({ rigueur, volonte, courage, raw }: SkillScores & { raw?: SkillsRaw | null }) {
  const cx = 124, cy = 122, R = 64;

  // Put Willpower on the dominant top axis so the shape reads around focus volume first.
  const vertices = [
    { angle: 270, label: 'Willpower',   value: rigueur },
    { angle: 150, label: 'Consistency', value: volonte },
    { angle: 30,  label: 'Deep runs',   value: courage },
  ];

  const toXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const toDisplayRadius = (score: number) => {
    const t = Math.max(0, Math.min(score, 100)) / 100;
    const minRadius = 16;
    return minRadius + Math.pow(t, 0.62) * (R - minRadius);
  };

  const getLabelLayout = (label: 'Consistency' | 'Willpower' | 'Deep runs') => {
    if (label === 'Willpower') {
      return {
        point: toXY(270, R + 38),
        textAnchor: 'middle' as const,
        titleDy: -8,
        valueDy: 8,
      };
    }
    if (label === 'Consistency') {
      return {
        point: toXY(150, R + 42),
        textAnchor: 'end' as const,
        titleDy: -2,
        valueDy: 14,
      };
    }
    return {
      point: toXY(30, R + 42),
      textAnchor: 'start' as const,
      titleDy: -2,
      valueDy: 14,
    };
  };

  const bgPts = vertices.map(v => toXY(v.angle, R));
  const midPts = vertices.map(v => toXY(v.angle, R * 0.62));
  const innerPts = vertices.map(v => toXY(v.angle, toDisplayRadius(v.value)));

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={248} height={244} viewBox="0 0 248 244" style={{ overflow: 'visible' }}>
        {/* Background triangle */}
        <path
          d={toPath(bgPts)}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
        <path
          d={toPath(midPts)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
          strokeDasharray="3 5"
        />
        {vertices.map((v) => {
          const axisEnd = toXY(v.angle, R);
          return (
            <line
              key={`${v.label}-axis`}
              x1={cx}
              y1={cy}
              x2={axisEnd.x}
              y2={axisEnd.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          );
        })}

        {/* Filled inner polygon */}
        <motion.path
          d={toPath(innerPts)}
          fill="rgba(251,146,60,0.12)"
          stroke="var(--accent-fire)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />

        {/* Vertex dots + labels */}
        {vertices.map((v) => {
          const dot = toXY(v.angle, toDisplayRadius(v.value));
          const labelLayout = getLabelLayout(v.label as 'Consistency' | 'Willpower' | 'Deep runs');
          return (
            <g key={v.label}>
              <circle cx={dot.x} cy={dot.y} r={3} fill="var(--accent-fire)" />
              <text
                x={labelLayout.point.x}
                y={labelLayout.point.y + labelLayout.titleDy}
                textAnchor={labelLayout.textAnchor}
                fontSize={9}
                fill="var(--text-muted)"
                fontFamily="inherit"
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {v.label}
              </text>
              <text
                x={labelLayout.point.x}
                y={labelLayout.point.y + labelLayout.valueDy}
                textAnchor={labelLayout.textAnchor}
                fontSize={12}
                fontWeight={500}
                fill="var(--text-primary)"
                fontFamily="inherit"
              >
                {formatSkillValue(v.label as 'Consistency' | 'Willpower' | 'Deep runs', raw || undefined)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CharacterPanel({ user }: CharacterPanelProps) {
  const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';
  const [profile, setProfile] = useState<UserProfile>({ total_xp: 0, level: 1 });
  const [skills, setSkills] = useState<SkillScores | null>(null);
  const [skillsRaw, setSkillsRaw] = useState<SkillsRaw | null>(null);
  const [memoryTeaser, setMemoryTeaser] = useState<string | null>(null);
  const [memoryHasSnapshots, setMemoryHasSnapshots] = useState(false);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
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
      setMemoryLoaded(true);
      if (!result.success) return;
      const snaps = result.snapshots || [];
      setMemoryHasSnapshots(snaps.length > 0);
      setMemoryTeaser(buildMemoryTeaser(snaps[0] || null));
    }).catch(() => {
      setMemoryLoaded(true);
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
      <motion.div variants={itemVariants} className="px-10" style={{ marginTop: -12 }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          minHeight: 96,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
            <Brain size={16} strokeWidth={1.75} />
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>Memory</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {!memoryLoaded
              ? 'Loading memory insight…'
              : memoryTeaser
              ? memoryTeaser
              : memoryHasSnapshots
                ? 'Your behavioral profile and charts are available in the Memory tab.'
                : 'Promethee saves a short behavioral snapshot when you use the app. After your first snapshot, a preview will show up here.'}
          </p>
        </div>
      </motion.div>

      {/* Skill triangle */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1 px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground pb-1">Skills</p>
        <p className="text-xs text-muted-foreground pb-2" style={{ margin: 0, lineHeight: 1.45 }}>
          {skillsRaw
            ? `Last 30 days: ${skillsRaw.sessionCount != null ? skillsRaw.sessionCount : '—'} sessions · ${skillsRaw.totalMinutes ?? 0} min · ${skillsRaw.deepSessions ?? 0} deep (≥2h) · ${skillsRaw.streak ?? 0}d streak`
            : 'Loading…'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4, paddingBottom: 4 }}>
          {skills ? <TriangleChart {...skills} raw={skillsRaw} /> : <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>}
        </div>
        <p className="text-xs text-muted-foreground pt-1" style={{ margin: 0, opacity: 0.75 }}>
          Scores scale to caps: 3 000 min · 30-day streak · 20 deep sessions
        </p>
      </motion.div>
    </motion.main>
  );
}

export default CharacterPanel;
