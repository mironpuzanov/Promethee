import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, Zap, Users } from 'lucide-react';

interface TodayStats {
  hours: string;
  xp: number;
  rank: number | null;
}

interface FeedEntry {
  id: string;
  display_name: string;
  task: string;
  room_id: string | null;
  started_at: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } },
};

const ROOM_ICONS: Record<string, string> = {
  'deep-work': '🔥',
  'study': '📚',
  'creative': '🎨',
};

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function RightPanel() {
  const [todayStats, setTodayStats] = useState<TodayStats>({ hours: '0.0', xp: 0, rank: null });
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [liveFeed, setLiveFeed] = useState<FeedEntry[]>([]);

  useEffect(() => {
    window.promethee.session.getToday().then((result: { success: boolean; sessions?: Array<{ duration_seconds?: number; xp_earned?: number }> }) => {
      if (result.success && result.sessions) {
        const totalSeconds = result.sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
        const totalXP = result.sessions.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
        const hours = (totalSeconds / 3600).toFixed(1);
        setTodayStats({ hours, xp: totalXP, rank: null });
      }
    });

    window.promethee.presence.getCount().then((result: { success: boolean; count?: number }) => {
      if (result.success && result.count !== undefined) setPresenceCount(result.count);
    });

    const unsubCount = window.promethee.presence.onCount((c: number) => setPresenceCount(c));
    const unsubFeed = window.promethee.presence.onFeed((feed: FeedEntry[]) => setLiveFeed(feed));

    return () => { unsubCount(); unsubFeed(); };
  }, []);

  const quests: { id: number; title: string; completed: boolean }[] = [];
  const titles: { name: string; progress: number }[] = [];

  return (
    <motion.aside
      className="flex h-full flex-col bg-background border-l border-border px-4 py-5 overflow-y-auto gap-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Active Quests */}
      {quests.length > 0 && (
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
      )}

      {/* Titles */}
      {titles.length > 0 && (
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
      )}

      {(quests.length > 0 || titles.length > 0) && (
        <motion.div variants={itemVariants} className="border-t border-border" />
      )}

      {/* Live presence count */}
      {presenceCount > 0 && (
        <motion.div variants={itemVariants} className="flex items-center gap-2">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.5)', display: 'inline-block', flexShrink: 0 }} />
          <span className="text-xs text-muted-foreground">
            <span style={{ color: '#22c55e', fontWeight: 600 }}>{presenceCount}</span> working right now
          </span>
        </motion.div>
      )}

      {/* Live feed */}
      {liveFeed.length > 0 && (
        <motion.div variants={itemVariants} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Users size={11} className="text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Live</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {liveFeed.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 py-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                >
                  {(entry.display_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-secondary-foreground font-medium truncate">
                      {entry.display_name || 'Someone'}
                    </span>
                    {entry.room_id && (
                      <span className="text-xs" title={entry.room_id}>
                        {ROOM_ICONS[entry.room_id] || ''}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{entry.task || 'working'}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>{timeAgo(entry.started_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {(presenceCount > 0 || liveFeed.length > 0) && (
        <motion.div variants={itemVariants} className="border-t border-border" />
      )}

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
