import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Zap } from 'lucide-react';

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
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
  return `${Math.floor(mins / 60)}h ago`;
}

function CommunityTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [presenceCount, setPresenceCount] = useState(0);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomPresence, setRoomPresence] = useState<Record<string, any[]>>({});

  useEffect(() => {
    window.promethee.leaderboard.get().then((r) => {
      if (r.success) setLeaderboard(r.leaderboard || []);
    });
    window.promethee.presence.getCount().then((r) => {
      if (r.success) setPresenceCount(r.count || 0);
    });
    window.promethee.presence.getRooms().then((r) => {
      if (r.success) {
        setRooms(r.rooms || []);
        setRoomPresence(r.roomPresence || {});
      }
    });

    const unsubCount = window.promethee.presence.onCount(setPresenceCount);
    const unsubFeed = window.promethee.presence.onFeed(setLiveFeed);
    return () => { unsubCount(); unsubFeed(); };
  }, []);

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-10 flex-1">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-light text-foreground">Community</h2>
        {presenceCount > 0 && (
          <div className="flex items-center gap-2">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.5)', display: 'inline-block' }} />
            <span className="text-sm text-muted-foreground">
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{presenceCount}</span> working right now
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left: Leaderboard */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-accent-orange" />
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Weekly Leaderboard</p>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <motion.div className="flex flex-col gap-1" initial="hidden" animate="visible" variants={listVariants}>
              {leaderboard.slice(0, 20).map((entry, i) => (
                <motion.div
                  key={entry.id}
                  variants={rowVariants}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card hover:bg-accent transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">
                    {i < 3 ? ['🥇','🥈','🥉'][i] : `${i + 1}`}
                  </span>
                  <span className="text-sm text-foreground flex-1 truncate">{entry.display_name || 'Anonymous'}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Zap size={11} className="text-accent-orange" />
                    <span className="text-xs font-medium text-accent-orange">{entry.weekly_xp}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Right: Rooms + Live feed */}
        <div className="flex flex-col gap-8">
          {/* Rooms */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Rooms</p>
            </div>
            <div className="flex flex-col gap-2">
              {rooms.map((room) => {
                const occupants = roomPresence[room.id] || [];
                return (
                  <div key={room.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card">
                    <span className="text-lg">{room.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">{room.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{room.description}</p>
                    </div>
                    {occupants.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                        <span className="text-xs font-medium" style={{ color: '#22c55e' }}>{occupants.length}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live feed */}
          {liveFeed.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Live Feed</p>
              <div className="flex flex-col gap-2">
                {liveFeed.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-card">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      {(entry.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-medium truncate">{entry.display_name || 'Someone'}</span>
                        {entry.room_id && <span className="text-sm">{ROOM_ICONS[entry.room_id]}</span>}
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{timeAgo(entry.started_at)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">started "{entry.task || 'a session'}"</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommunityTab;
