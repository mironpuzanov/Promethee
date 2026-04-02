import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Clock, Trophy, Share2, X } from 'lucide-react';

interface Props {
  task: string;
  durationSeconds: number;
  xpEarned: number;
  onClose: () => void;
}

function formatDuration(seconds: number): { main: string; sub: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return { main: `${h}h ${m}m`, sub: `${seconds}s total` };
  if (m > 0) return { main: `${m}m ${s}s`, sub: `${seconds}s total` };
  return { main: `${s}s`, sub: 'quick session' };
}

export default function SessionCompleteScreen({ task, durationSeconds, xpEarned, onClose }: Props) {
  const [rank, setRank] = useState<number | null>(null);
  const [animDone, setAnimDone] = useState(false);
  const duration = formatDuration(durationSeconds);

  useEffect(() => {
    window.promethee.leaderboard.get().then((r: any) => {
      if (r.success && r.leaderboard) {
        window.promethee.auth.getUser().then((ur: any) => {
          if (ur.success && ur.user) {
            const entry = r.leaderboard.find((e: any) => e.id === ur.user.id);
            if (entry?.rank) setRank(entry.rank);
          }
        });
      }
    });
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Geist, -apple-system, sans-serif',
      color: '#fff',
      overflow: 'hidden',
    }}>
      {/* Subtle background glow */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 400,
        background: 'radial-gradient(ellipse, rgba(232,146,42,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Drag region */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 48, WebkitAppRegion: 'drag' as any }} />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        onAnimationComplete={() => setAnimDone(true)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          width: '100%',
          maxWidth: 540,
          padding: '0 48px',
        }}
      >
        {/* Top label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ fontSize: 11, color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase' }}
        >
          Session complete
        </motion.div>

        {/* Task name */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 20 }}
          style={{
            fontSize: 34,
            fontWeight: 300,
            letterSpacing: '-0.03em',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.15,
          }}
        >
          {task}
        </motion.h1>

        {/* Stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
            <StatCard
              icon={<Clock size={14} color="#555" />}
              label="Duration"
              value={duration.main}
            />
            <StatCard
              icon={<Zap size={14} color="#E8922A" />}
              label="XP Earned"
              value={xpEarned > 0 ? `+${xpEarned}` : '0'}
              valueColor="#E8922A"
              suffix="XP"
            />
          </div>
          {rank && (
            <StatCard
              icon={<Trophy size={14} color="#E8922A" />}
              label="Rank"
              value={`#${rank}`}
              valueColor="#E8922A"
              suffix="this week"
              wide
            />
          )}
        </motion.div>

        {/* XP bar */}
        {xpEarned > 0 && animDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#444' }}>
              <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>XP</span>
              <span>+{xpEarned}</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #E8922A 0%, #F5A84A 100%)', borderRadius: 2 }}
              />
            </div>
          </motion.div>
        )}

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ display: 'flex', gap: 12, width: '100%' }}
        >
          <button
            onClick={() => alert('Sharing coming soon!')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '13px 20px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            <Share2 size={15} />
            Share
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '13px 20px',
              color: '#000',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
          >
            <X size={15} />
            Close
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, label, value, valueColor = '#fff', suffix, wide }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  suffix?: string;
  wide?: boolean;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: wide ? 'row' : 'column',
      alignItems: wide ? 'center' : undefined,
      justifyContent: wide ? 'space-between' : undefined,
      gap: wide ? 0 : 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 32, fontWeight: 500, color: valueColor, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: 13, color: '#555' }}>{suffix}</span>}
      </div>
    </div>
  );
}
