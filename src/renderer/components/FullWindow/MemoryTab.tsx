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

interface MemoryData {
  snapshots: Snapshot[];
  current: Current;
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

function SkillBar({ label, value }: { label: string; value: number }) {
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
      <span style={{ width: 28, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
        {value}
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

// Mini bar chart: one bar per snapshot, height = total_minutes normalized
function ActivityChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) return null;
  const ordered = [...snapshots].reverse(); // oldest first
  const maxMinutes = Math.max(...ordered.map(s => s.total_minutes || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, width: '100%' }}>
      {ordered.map((s, i) => {
        const h = Math.max(2, Math.round(((s.total_minutes || 0) / maxMinutes) * 40));
        return (
          <div
            key={s.snapshot_date}
            title={`${s.snapshot_date}: ${s.total_minutes || 0}m`}
            style={{
              flex: 1,
              height: h,
              background: i === ordered.length - 1
                ? 'var(--accent-fire)'
                : 'var(--accent-glow-strong)',
              borderRadius: 2,
              transition: 'height 0.5s ease',
            }}
          />
        );
      })}
    </div>
  );
}

export default function MemoryTab() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.promethee.memory.get().then((result) => {
      if (result.success) {
        setData({ snapshots: result.snapshots || [], current: result.current });
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6">
        <h2 className="text-2xl font-light text-foreground">Memory</h2>
        <p className="text-sm text-muted-foreground">Loading…</p>
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

  // Latest skills
  const latestSkills = snapshots.find(s => s.top_skills)?.top_skills ?? null;

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
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {snapshotCount === 0
            ? 'Prométhée starts building your memory profile from your first session.'
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
          Prométhée is still learning. Patterns become visible after 3+ days of data.
          {latestSummary && <span> Here's what's visible so far.</span>}
        </motion.div>
      )}

      {/* No data at all */}
      {snapshotCount === 0 && (
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 460 }}>
            Complete your first session and return here tomorrow — Prométhée will have built the first page of your profile.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            At day 90, the full reveal unlocks: time patterns, focus trajectory, skill arc, and a narrative Prométhée has been writing about you since day 1.
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
      {snapshots.length > 1 && (
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: 0 }}>
            Daily focus minutes
          </p>
          <ActivityChart snapshots={snapshots} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
            <span>{snapshots[snapshots.length - 1]?.snapshot_date}</span>
            <span>today</span>
          </div>
        </motion.div>
      )}

      {/* Prométhée's observation */}
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
            Prométhée observes
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
      {latestSkills && (
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: 0 }}>
            Skill trajectory
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkillBar label="Rigueur" value={latestSkills.rigueur} />
            <SkillBar label="Volonté" value={latestSkills.volonte} />
            <SkillBar label="Courage" value={latestSkills.courage} />
          </div>
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
            A complete portrait — time patterns, focus arc, skill evolution, and a narrative written by Prométhée from day 1.
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
            Prométhée has observed you for 90 days. The full profile — time patterns, behavioural arc, skill trajectory, and narrative — is above.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
