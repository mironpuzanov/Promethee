import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Flame, Zap, Clock, Target, TrendingUp } from 'lucide-react';

interface Snapshot {
  id: string;
  snapshot_date: string;
  behavioral_summary: string | null;
  emotional_tags: string[] | null;
  peak_hours: string | null;
  avg_session_duration_minutes: number | null;
  top_skills: { rigueur: number; volonte: number; courage: number } | null;
  quest_completion_rate: number | null;
  streak_at_snapshot: number | null;
  session_count: number | null;
  total_minutes: number | null;
}

interface Current {
  streak: number;
  totalMinutes30d: number;
  deepSessions30d: number;
  totalXp: number;
  level: number;
  snapshotCount: number;
}

interface TodaySession {
  duration_seconds?: number;
}

interface MemoryData {
  snapshots: Snapshot[];
  current: Current;
}

interface LiveSkills {
  rigueur: number;
  volonte: number;
  courage: number;
}

interface LiveSkillsRaw {
  totalMinutes: number;
  streak: number;
  deepSessions: number;
  sessionCount?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 110, damping: 16 } },
};

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div style={{
      flex: '1 1 0',
      minWidth: 140,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)' }}>
        {icon}
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 500, color: accent || 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: 'var(--accent-glow)',
      border: '1px solid var(--border-accent)',
      color: 'var(--accent-fire)',
      borderRadius: 20,
      padding: '3px 10px',
      fontSize: 11,
      fontWeight: 500,
    }}>
      {tag}
    </span>
  );
}

function SkillBar({ label, value, display }: { label: string; value: number; display: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 70, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: 'var(--accent-fire)', borderRadius: 2 }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <span style={{ width: 38, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
        {display}
      </span>
    </div>
  );
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${m}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function formatMinutesCompact(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

function formatDayTick(dateStr: string): string {
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (dateStr === todayStr) return 'today';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function buildChartSeries(snapshots: Snapshot[], todayMinutes: number) {
  const byDate = new Map<string, number>();
  for (const snapshot of snapshots) {
    byDate.set(snapshot.snapshot_date, snapshot.total_minutes || 0);
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const dates = Array.from({ length: 7 }, (_, idx) => shiftDate(todayStr, idx - 6));
  return dates.map((date) => ({
    date,
    minutes: date === todayStr ? todayMinutes : (byDate.get(date) || 0),
  }));
}

function ActivityChart({ snapshots, todayMinutes }: { snapshots: Snapshot[]; todayMinutes: number }) {
  const series = buildChartSeries(snapshots, todayMinutes);
  const maxMinutes = Math.max(...series.map((s) => s.minutes), 1);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
      <div style={{ width: 34, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 20 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{maxMinutes}m</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>0m</span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        height: 124,
        width: '100%',
        padding: '12px 10px 10px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid var(--border)',
      }}>
        {series.map((s, i) => {
          const h = s.minutes === 0 ? 6 : Math.max(10, Math.round((s.minutes / maxMinutes) * 64));
          const isLatest = i === series.length - 1;
          return (
            <div key={s.date} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
              <span
                title={`${s.date}: ${s.minutes}m`}
                style={{
                  fontSize: 10,
                  color: isLatest ? 'var(--text-primary)' : 'var(--text-muted)',
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                  minHeight: 12,
                }}
              >
                {s.minutes > 0 ? `${s.minutes}m` : ''}
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: h,
                    background: isLatest
                      ? 'var(--accent-fire)'
                      : s.minutes > 0
                        ? 'rgba(232, 146, 42, 0.55)'
                        : 'rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    transition: 'height 0.5s ease',
                    boxShadow: isLatest ? '0 6px 24px rgba(232, 146, 42, 0.22)' : 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', textTransform: 'lowercase' }}>
                {formatDayTick(s.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MemoryTab() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [liveSkills, setLiveSkills] = useState<LiveSkills | null>(null);
  const [liveSkillsRaw, setLiveSkillsRaw] = useState<LiveSkillsRaw | null>(null);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Load skills and today's sessions immediately (local SQLite — fast)
    Promise.all([
      window.promethee.skills.get(),
      window.promethee.session.getToday(),
    ]).then(([skillsResult, sessionsResult]) => {
      if (skillsResult.success && skillsResult.skills) {
        setLiveSkills(skillsResult.skills as LiveSkills);
        if (skillsResult.raw) setLiveSkillsRaw(skillsResult.raw as LiveSkillsRaw);
      }
      if (sessionsResult.success && sessionsResult.sessions) {
        const minutes = (sessionsResult.sessions as TodaySession[]).reduce(
          (sum, session) => sum + Math.floor((session.duration_seconds || 0) / 60),
          0
        );
        setTodayMinutes(minutes);
      }
    });

    // memory.get awaits Supabase refresh (up to 5s) — show syncing indicator
    setSyncing(true);
    window.promethee.memory.get().then((memoryResult: any) => {
      if (memoryResult.success) {
        setData({ snapshots: memoryResult.snapshots || [], current: memoryResult.current });
      }
      setLoading(false);
      setSyncing(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6">
        <h2 className="text-2xl font-light text-foreground">Memory</h2>
        <p className="text-sm text-muted-foreground">Syncing from cloud…</p>
      </div>
    );
  }

  const snapshots = data?.snapshots || [];
  const current = data?.current;
  const snapshotCount = snapshots.length;
  const isEarlyData = snapshotCount < 3;

  // Derive aggregate tags from all snapshots
  const allTags: Record<string, number> = {};
  for (const s of snapshots) {
    for (const tag of s.emotional_tags || []) {
      allTags[tag] = (allTags[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(allTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // Most frequent peak hour across snapshots
  const peakHourCounts: Record<string, number> = {};
  for (const s of snapshots) {
    if (s.peak_hours) peakHourCounts[s.peak_hours] = (peakHourCounts[s.peak_hours] || 0) + 1;
  }
  const dominantPeakHour = Object.entries(peakHourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Latest behavioral summary
  const latestSummary = snapshots.find(s => s.behavioral_summary)?.behavioral_summary ?? null;

  // Avg session duration across all snapshots
  const durationsWithData = snapshots.filter(s => (s.avg_session_duration_minutes || 0) > 0);
  const avgDuration = durationsWithData.length
    ? Math.round(durationsWithData.reduce((s, r) => s + (r.avg_session_duration_minutes || 0), 0) / durationsWithData.length)
    : 0;

  return (
    <motion.div
      className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-8"
      style={{ minHeight: 0, flex: 1 }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={20} style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-2xl font-light text-foreground" style={{ margin: 0 }}>Memory</h2>
          {syncing && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>Syncing…</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {snapshotCount === 0
            ? 'Promethee starts building your memory profile from your first session.'
            : `${snapshotCount} day${snapshotCount !== 1 ? 's' : ''} of observation`}
        </p>
      </motion.div>

      {/* Early data notice */}
      {isEarlyData && snapshotCount > 0 && (
        <motion.div variants={itemVariants} style={{
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 12,
          padding: '12px 16px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          Promethee is still learning. Patterns become visible after 3+ days of data.
          {latestSummary && <span> Here's what's visible so far.</span>}
        </motion.div>
      )}

      {/* No data at all */}
      {snapshotCount === 0 && (
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 460 }}>
            Complete your first session and return here tomorrow — Promethee will have built the first page of your profile.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            At day 90, the full reveal unlocks: time patterns, focus trajectory, skill arc, and a narrative Promethee has been writing about you since day 1.
          </p>
        </motion.div>
      )}

      {/* Current stats */}
      {current && (
        <motion.div variants={itemVariants} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatCard
            icon={<Flame size={12} />}
            label="Streak"
            value={`${current.streak}d`}
            sub="consecutive days"
            accent={current.streak >= 7 ? 'var(--accent-fire)' : undefined}
          />
          <StatCard
            icon={<Clock size={12} />}
            label="Focus (30d)"
            value={formatMinutes(current.totalMinutes30d)}
            sub="last 30 days"
          />
          <StatCard
            icon={<TrendingUp size={12} />}
            label="Deep sessions"
            value={String(current.deepSessions30d)}
            sub="≥ 2h each"
          />
          <StatCard
            icon={<Zap size={12} />}
            label="Total XP"
            value={String(current.totalXp)}
            sub={`Level ${current.level}`}
            accent="var(--accent-fire)"
          />
        </motion.div>
      )}

      {/* Activity chart */}
      {(snapshots.length > 0 || todayMinutes > 0) && (
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: 0 }}>
            Daily focus minutes
          </p>
          <ActivityChart snapshots={snapshots} todayMinutes={todayMinutes} />
        </motion.div>
      )}

      {/* Promethee observation */}
      {latestSummary && (
        <motion.div variants={itemVariants} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', margin: 0 }}>
            Promethee observes
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
            "{latestSummary}"
          </p>
        </motion.div>
      )}

      {/* Patterns */}
      {(dominantPeakHour || avgDuration > 0 || topTags.length > 0) && (
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: 0 }}>
            Patterns
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dominantPeakHour && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Peak focus window</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{dominantPeakHour}</span>
              </div>
            )}
            {avgDuration > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Avg session length</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{formatMinutes(avgDuration)}</span>
              </div>
            )}
            {topTags.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Behavioral tags</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {topTags.map(tag => <TagBadge key={tag} tag={tag} />)}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Skill trajectory */}
      {liveSkills && (
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: 0 }}>
            Focus stats (live)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkillBar
              label="Willpower"
              value={liveSkills.rigueur}
              display={formatMinutesCompact(liveSkillsRaw?.totalMinutes || 0)}
            />
            <SkillBar
              label="Consistency"
              value={liveSkills.volonte}
              display={`${liveSkillsRaw?.streak || 0}d`}
            />
            <SkillBar
              label="Deep runs"
              value={liveSkills.courage}
              display={String(liveSkillsRaw?.deepSessions || 0)}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Bars are normalized for shape, but the numbers shown are real values: focus minutes over the last 30 days, current streak days, and 2h+ sessions.
          </p>
        </motion.div>
      )}

      {/* 90-day teaser */}
      {snapshotCount < 90 && snapshotCount > 0 && (
        <motion.div variants={itemVariants} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Full reveal unlocks at day 90</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{snapshotCount}/90</span>
          </div>
          <div style={{ height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(snapshotCount / 90) * 100}%`, background: 'var(--accent-glow-strong)', borderRadius: 1 }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
            A complete portrait — time patterns, focus arc, skill evolution, and a narrative written by Promethee from day 1.
          </p>
        </motion.div>
      )}

      {/* Full 90-day reveal */}
      {snapshotCount >= 90 && (
        <motion.div variants={itemVariants} style={{
          background: 'var(--accent-glow)',
          border: '1px solid var(--border-accent)',
          borderRadius: 14,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={16} style={{ color: 'var(--accent-fire)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>90-day reveal unlocked</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
            Promethee has observed you for 90 days. The full profile — time patterns, behavioural arc, skill trajectory, and narrative — is above.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
