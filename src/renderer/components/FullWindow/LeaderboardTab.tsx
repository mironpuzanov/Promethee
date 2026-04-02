import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
};

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    window.promethee.leaderboard.get().then((r: any) => {
      if (r.success) setLeaderboard(r.leaderboard || []);
    });
    window.promethee.auth.getUser().then((r: any) => {
      if (r.success && r.user) setCurrentUserId(r.user.id);
    });
  }, []);

  const myEntry = leaderboard.find(e => e.id === currentUserId);

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6 flex-1">
      <div>
        <h2 className="text-2xl font-light text-foreground">Leaderboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Weekly XP rankings. Resets every Monday.</p>
      </div>

      {myEntry && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-accent-fire/20 bg-accent-fire/5">
          <span className="text-sm text-muted-foreground w-6 text-right flex-shrink-0">#{myEntry.rank}</span>
          <span className="text-sm font-medium text-foreground flex-1">You ({myEntry.display_name})</span>
          <div className="flex items-center gap-1">
            <Zap size={12} className="text-accent-orange" />
            <span className="text-sm font-semibold text-accent-orange">{myEntry.weekly_xp} XP</span>
          </div>
        </div>
      )}

      {leaderboard.length === 0 ? null : (
        <motion.div className="flex flex-col gap-1" initial="hidden" animate="visible" variants={listVariants}>
          {leaderboard.map((entry, i) => {
            const isMe = entry.id === currentUserId;
            return (
              <motion.div
                key={entry.id}
                variants={rowVariants}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isMe ? 'bg-accent' : 'bg-card hover:bg-accent'}`}
              >
                <span className="text-sm text-muted-foreground w-6 text-right flex-shrink-0">
                  {i < 3 ? MEDALS[i] : i + 1}
                </span>
                <span className={`text-sm flex-1 truncate ${isMe ? 'text-foreground font-medium' : 'text-foreground'}`}>
                  {entry.display_name || 'Anonymous'}
                  {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap size={11} className="text-accent-orange" />
                  <span className="text-xs font-medium text-accent-orange">{entry.weekly_xp}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
