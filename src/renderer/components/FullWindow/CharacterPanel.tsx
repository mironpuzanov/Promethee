import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Check, Circle } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { getLevelInfo } from '../../../lib/xp';
import homeBg from '../../../assets/home-bg-group1.png';
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

interface StandaloneTask {
  id: string;
  text: string;
  completed: number;
  xp_reward?: number | null;
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

function buildRadarData(scores: SkillScores, raw?: SkillsRaw | null) {
  return [
    { skill: 'Willpower',   value: scores.rigueur, raw: raw ? `${raw.totalMinutes}m` : '—' },
    { skill: 'Consistency', value: scores.volonte,  raw: raw ? `${raw.streak}d streak` : '—' },
    { skill: 'Deep runs',   value: scores.courage,  raw: raw ? String(raw.deepSessions) : '—' },
  ];
}

function SkillRadarChart({ rigueur, volonte, courage, raw }: SkillScores & { raw?: SkillsRaw | null }) {
  const data = buildRadarData({ rigueur, volonte, courage }, raw);

  return (
    <div style={{ width: '100%', height: 260, pointerEvents: 'none', userSelect: 'none' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={data}
          margin={{ top: 44, right: 64, bottom: 44, left: 64 }}
        >
          <PolarGrid
            stroke="var(--border)"
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="skill"
            tick={({ x, y, textAnchor, index }: any) => {
              const d = data[index];
              const yNum = typeof y === 'number' ? y : 0;
              const yOffset = index === 0 ? -20 : 4;
              return (
                <text
                  x={x}
                  y={yNum + yOffset}
                  textAnchor={textAnchor}
                  fontFamily="inherit"
                >
                  <tspan fontSize={12} fontWeight={500} fill="var(--text-primary)">
                    {d.raw}
                  </tspan>
                  <tspan x={x} dy="1.6em" fontSize={9} fill="var(--text-muted)">
                    {d.skill.toUpperCase()}
                  </tspan>
                </text>
              );
            }}
          />
          <Radar
            dataKey="value"
            fill="rgba(232,146,42,0.15)"
            stroke="var(--accent-fire)"
            strokeWidth={1.5}
            dot={{ fill: 'var(--accent-fire)', r: 3, strokeWidth: 0 }}
            activeDot={false}
          />
        </RadarChart>
      </ResponsiveContainer>
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
  const [standaloneTasks, setStandaloneTasks] = useState<StandaloneTask[]>([]);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const removeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

    // Load standalone tasks (no session attached)
    window.promethee.tasks.listAll().then((r: { success: boolean; tasks?: StandaloneTask[] }) => {
      if (r.success) {
        setStandaloneTasks((r.tasks || []).filter((t) => !(t as any).session_id && !t.completed));
      }
    });

    return unsub;
  }, []);

  const onToggleTask = useCallback(async (taskId: string) => {
    await window.promethee.tasks.toggle(taskId);
    // Check if the task is now complete — if so, animate it out after a short delay
    const r = await window.promethee.tasks.listAll() as { success: boolean; tasks?: StandaloneTask[] };
    if (!r.success) return;
    const all = (r.tasks || []).filter((t: any) => !t.session_id && !t.completed);
    const toggled = all.find((t) => t.id === taskId);
    if (toggled && toggled.completed) {
      // Mark as "removing" so it shows checked briefly, then remove from list
      setRemovingIds((prev) => new Set(prev).add(taskId));
      const timer = setTimeout(() => {
        setStandaloneTasks((prev) => prev.filter((t) => t.id !== taskId));
        setRemovingIds((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
        removeTimers.current.delete(taskId);
      }, 600);
      removeTimers.current.set(taskId, timer);
    } else {
      setStandaloneTasks(all);
    }
  }, []);

  const levelInfo = getLevelInfo(profile.total_xp || 0);
  const { level, tier, totalXP, xpIntoLevel, xpForCurrentLevel, progress: xpProgress } = levelInfo;

  return (
    <motion.main
      className="flex flex-col bg-background gap-4"
      style={{ overflow: 'hidden', height: '100%' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero header */}
      <motion.div
        variants={itemVariants}
        className="px-10"
        style={{ paddingTop: 32, paddingBottom: 8, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>{userName}</h1>
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
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', background: 'var(--accent-fire)', borderRadius: 2 }}
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{totalXP} XP total</span>
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
            style={{ paddingLeft: 40, paddingRight: 40, flexShrink: 0 }}
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

      {/* Standalone tasks */}
      {standaloneTasks.length > 0 && (
        <motion.div variants={itemVariants} className="px-10" style={{ flexShrink: 0 }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 }}>
              Quests
            </div>
            <AnimatePresence initial={false}>
              {standaloneTasks.map((task) => {
                const done = Boolean(task.completed) || removingIds.has(task.id);
                return (
                  <motion.div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleTask(task.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleTask(task.id); } }}
                    initial={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 16px', cursor: 'pointer',
                      borderTop: '1px solid var(--border)',
                      opacity: done ? 0.45 : 1,
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {done ? <Check size={15} strokeWidth={2.5} /> : <Circle size={15} strokeWidth={1.75} />}
                    </span>
                    <span style={{ fontSize: 13, flex: 1, textDecoration: done ? 'line-through' : 'none', color: 'var(--foreground)' }}>
                      {task.text}
                    </span>
                    {task.xp_reward ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#fbbf24' }}>+{task.xp_reward} XP</span>
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Memory preview (Supabase snapshots — same source as Memory tab) */}
      <motion.div variants={itemVariants} className="px-10" style={{ flexShrink: 0 }}>
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
      <motion.div variants={itemVariants} className="flex flex-col gap-1 px-10" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingBottom: 16 }}>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground pb-1">Skills</p>
        <p className="text-xs text-muted-foreground pb-2" style={{ margin: 0, lineHeight: 1.45 }}>
          {skillsRaw
            ? `Last 30 days: ${skillsRaw.sessionCount != null ? skillsRaw.sessionCount : '—'} sessions · ${skillsRaw.totalMinutes ?? 0} min · ${skillsRaw.deepSessions ?? 0} deep (≥2h) · ${skillsRaw.streak ?? 0}d streak`
            : 'Loading…'}
        </p>
        <div style={{ paddingTop: 4, paddingBottom: 4 }}>
          {skills ? <SkillRadarChart {...skills} raw={skillsRaw} /> : <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>}
        </div>
        <p className="text-xs text-muted-foreground pt-1" style={{ margin: 0, opacity: 0.75 }}>
          Scores scale to caps: 3 000 min · 30-day streak · 20 deep sessions
        </p>
      </motion.div>
    </motion.main>
  );
}

export default CharacterPanel;
