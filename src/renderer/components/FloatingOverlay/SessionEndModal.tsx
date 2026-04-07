import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SessionEndModalProps {
  task: string;
  durationSeconds: number;
  xpEarned: number;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function SessionEndModal({ task, durationSeconds, xpEarned, onClose }: SessionEndModalProps) {
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    // Auto-dismiss after 6 seconds
    const timer = setTimeout(onClose, 6000);

    // Fetch current rank from leaderboard
    window.promethee.leaderboard.get().then((result: { success: boolean; leaderboard?: any[] }) => {
      if (result.success && result.leaderboard) {
        const userEntry = result.leaderboard.find((e: any) => e.rank !== undefined);
        if (userEntry?.rank) setRank(userEntry.rank);
      }
    });

    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="promethee-mouse-target"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(16,16,16,0.96)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '20px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 300,
        cursor: 'pointer',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Session complete
        </span>
        {rank && (
          <span style={{ fontSize: 12, color: '#E8922A', fontWeight: 600 }}>
            #{rank} today
          </span>
        )}
      </div>

      {/* Task name */}
      <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', lineHeight: 1.3 }}>
        {task}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, marginTop: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#ccc' }}>{formatDuration(durationSeconds)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>XP earned</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#E8922A' }}>+{xpEarned} XP</span>
        </div>
      </div>

      {/* Progress bar (XP flash) */}
      {xpEarned > 0 && (
        <motion.div
          style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 6, ease: 'linear' }}
            style={{ height: '100%', background: '#E8922A', borderRadius: 2 }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

export default SessionEndModal;
