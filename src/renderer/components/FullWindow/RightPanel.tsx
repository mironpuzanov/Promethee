import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, CheckSquare, Square, Trophy, Clock, Zap } from 'lucide-react';

interface TodayStats {
  hours: string;
  xp: number;
  rank: number | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } },
};

function RightPanel() {
  const [todayStats, setTodayStats] = useState<TodayStats>({ hours: '0.0', xp: 0, rank: null });

  useEffect(() => {
    window.promethee.session.getToday().then((result: { success: boolean; sessions?: Array<{ duration_seconds?: number; xp_earned?: number }> }) => {
      if (result.success && result.sessions) {
        const totalSeconds = result.sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
        const totalXP = result.sessions.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
        const hours = (totalSeconds / 3600).toFixed(1);
        setTodayStats({ hours, xp: totalXP, rank: null });
      }
    });
  }, []);

  const quests = [
    { id: 1, title: 'Build prototype', completed: false },
    { id: 2, title: 'Ship before Paris', completed: false },
  ];

  const titles = [
    { name: 'Builder', progress: 75 },
    { name: 'Focused', progress: 25 },
  ];

  return (
    <motion.aside
      className="flex h-full flex-col bg-background border-l border-border px-4 py-5 overflow-y-auto gap-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Search */}
      <motion.div variants={itemVariants} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <input
          type="text"
          placeholder="Search..."
          className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
        />
      </motion.div>

      {/* Active Quests */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Active Quest</p>
        <div className="flex flex-col gap-2">
          {quests.map(quest => (
            <div key={quest.id} className="flex items-center gap-2.5 text-sm text-secondary-foreground">
              {quest.completed
                ? <CheckSquare size={15} className="text-accent-orange flex-shrink-0" />
                : <Square size={15} className="text-muted-foreground flex-shrink-0" />
              }
              <span>{quest.title}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="border-t border-border" />

      {/* Titles */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Titles</p>
        <div className="flex flex-col gap-3">
          {titles.map(title => (
            <div key={title.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary-foreground">{title.name}</span>
                <span className="text-xs text-muted-foreground">{title.progress}%</span>
              </div>
              <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-orange rounded-full transition-all duration-500"
                  style={{ width: `${title.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="border-t border-border" />

      {/* Today Stats */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Today</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 bg-card rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock size={12} />
              <span className="text-xs">Time</span>
            </div>
            <span className="text-lg font-medium text-foreground">{todayStats.hours}h</span>
          </div>
          <div className="flex flex-col gap-1 bg-card rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap size={12} />
              <span className="text-xs">XP</span>
            </div>
            <span className="text-lg font-medium text-foreground">{todayStats.xp}</span>
          </div>
          {todayStats.rank && (
            <div className="flex flex-col gap-1 bg-card rounded-lg p-3 col-span-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Trophy size={12} />
                <span className="text-xs">Rank</span>
              </div>
              <span className="text-lg font-medium text-foreground">#{todayStats.rank}</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.aside>
  );
}

export default RightPanel;
