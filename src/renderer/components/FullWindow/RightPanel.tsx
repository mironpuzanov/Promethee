import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Square, Trophy, Clock, Zap, Users, Music, VolumeX, Monitor, Flame } from 'lucide-react';
import { shouldIncludeAppInUsageStats } from '../../../lib/appUsageFilter.js';
import './RightPanel.css';

interface TodayStats {
  hours: string;
  xp: number;
  rank: number | null;
  streak: number;
}

interface Quest {
  id: string;
  title: string;
  completed_at: number | null;
  type: string;
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

interface AppUsage {
  name: string;
  pct: number;
}

function RightPanel() {
  const [todayStats, setTodayStats] = useState<TodayStats>({ hours: '0.0', xp: 0, rank: null, streak: 0 });
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [liveFeed, setLiveFeed] = useState<FeedEntry[]>([]);
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [musicMuted, setMusicMuted] = useState(false);
  const [todayApps, setTodayApps] = useState<AppUsage[]>([]);

  const toggleMusic = () => {
    const next = !musicMuted;
    setMusicMuted(next);
    window.promethee.audio?.sendMuteToggle(next);
  };

  useEffect(() => {
    const loadTodayApps = () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      window.promethee.tracking.getEvents({ sinceMs: todayStart.getTime(), limit: 500 }).then((r: any) => {
        if (!r.success || !r.events?.length) {
          setTodayApps([]);
          return;
        }
        const events = r.events.filter((e: { app_name?: string }) => shouldIncludeAppInUsageStats(e.app_name || ''));
        if (!events.length) {
          setTodayApps([]);
          return;
        }
        const counts: Record<string, number> = {};
        for (const e of events) counts[e.app_name] = (counts[e.app_name] || 0) + 1;
        const total = events.length;
        const apps = Object.entries(counts)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, count]: any) => ({ name, pct: Math.round((count / total) * 100) }));
        setTodayApps(apps);
      });
    };

    window.promethee.session.getToday().then((result: { success: boolean; sessions?: Array<{ duration_seconds?: number; xp_earned?: number }> }) => {
      if (result.success && result.sessions) {
        const totalSeconds = result.sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
        const totalXP = result.sessions.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
        const hours = (totalSeconds / 3600).toFixed(1);
        setTodayStats((prev) => ({ ...prev, hours, xp: totalXP, rank: null }));
      }
    });

    window.promethee.db.getUserProfile().then((result: { success: boolean; profile?: { current_streak?: number } }) => {
      if (result.success && result.profile) {
        setTodayStats((prev) => ({ ...prev, streak: result.profile?.current_streak || 0 }));
      }
    });

    window.promethee.quests.list().then((result: { success: boolean; quests?: Quest[] }) => {
      if (result.success && result.quests) {
        const incomplete = result.quests.filter(q => !q.completed_at).slice(0, 3);
        setActiveQuests(incomplete);
      }
    });

    window.promethee.presence.getCount().then((result: { success: boolean; count?: number }) => {
      if (result.success && result.count !== undefined) setPresenceCount(result.count);
    });

    const unsubCount = window.promethee.presence.onCount((c: number) => setPresenceCount(c));
    const unsubFeed = window.promethee.presence.onFeed((feed: FeedEntry[]) => setLiveFeed(feed));

    loadTodayApps();
    const onFocus = () => loadTodayApps();
    window.addEventListener('focus', onFocus);

    return () => {
      unsubCount();
      unsubFeed();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <motion.aside
      className="flex h-full flex-col bg-background border-l border-border"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {/* Search */}
        <motion.div variants={itemVariants}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
            />
          </div>
        </motion.div>

      {/* Active Quests */}
      {activeQuests.length > 0 && (
        <>
          <motion.div variants={itemVariants} className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Active Quest</p>
            <div className="flex flex-col gap-2">
              {activeQuests.map(quest => (
                <div key={quest.id} className="flex items-center gap-2.5 text-sm text-secondary-foreground">
                  <Square size={15} className="text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{quest.title}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={itemVariants} className="border-t border-border" />
        </>
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
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}
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
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{timeAgo(entry.started_at)}</span>
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
          {todayStats.streak > 0 && (
            <div
              className="right-panel-streak"
              title={`${todayStats.streak}-day streak`}
            >
              <div className="right-panel-streak__icon">
                <Flame size={12} />
              </div>
              <div className="right-panel-streak__body">
                <span className="right-panel-streak__label">Streak</span>
                <span className="right-panel-streak__value">{todayStats.streak} day{todayStats.streak === 1 ? '' : 's'}</span>
              </div>
            </div>
          )}
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

        {/* Today's app usage */}
        {todayApps.length > 0 && (
          <motion.div variants={itemVariants} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Monitor size={11} className="text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Apps today</p>
            </div>
            <div className="flex flex-col gap-2">
              {todayApps.map(({ name, pct }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs text-secondary-foreground truncate" style={{ width: 90 }}>{name}</span>
                  <div className="flex-1 h-1 rounded-full bg-card overflow-hidden">
                    <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground" style={{ width: 28, textAlign: 'right' }}>{pct}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Music toggle — pinned bottom right */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-end px-4 py-3 border-t border-border"
      >
        <button
          onClick={toggleMusic}
          title={musicMuted ? 'Unmute music' : 'Mute music'}
          type="button"
          className={`right-panel-music-btn cursor-pointer flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors ${musicMuted ? 'right-panel-music-btn--muted' : 'right-panel-music-btn--on'}`}
        >
          {musicMuted ? <VolumeX size={13} /> : <Music size={13} />}
          <span>{musicMuted ? 'Music off' : 'Music on'}</span>
        </button>
      </motion.div>
    </motion.aside>
  );
}

export default RightPanel;
