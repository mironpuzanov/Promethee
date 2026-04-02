import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Occupant {
  user_id: string;
  display_name: string;
  task: string;
}

function timeWorking(startedAt: number): string {
  const mins = Math.floor((Date.now() - startedAt) / 60000);
  if (mins < 1) return 'just joined';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const STATIC_ROOMS: Room[] = [
  { id: 'deep-work', name: 'Deep Work', description: 'No distractions. Build serious things.', icon: '🔥' },
  { id: 'study',     name: 'Study',     description: 'Learning mode. Books open, brain on.',  icon: '📚' },
  { id: 'creative',  name: 'Creative',  description: 'Design, writing, music, art.',           icon: '🎨' },
];

export default function RoomsTab() {
  const [rooms, setRooms] = useState<Room[]>(STATIC_ROOMS);
  const [roomPresence, setRoomPresence] = useState<Record<string, Occupant[]>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.promethee.presence.getRooms().then((r: any) => {
      if (r.success) {
        // Use Supabase rooms if available, fall back to static
        if (r.rooms && r.rooms.length > 0) setRooms(r.rooms);
        setRoomPresence(r.roomPresence || {});
      }
    });

    // Live updates
    const unsub = window.promethee.presence.onCount(() => {
      window.promethee.presence.getRooms().then((r: any) => {
        if (r.success) setRoomPresence(r.roomPresence || {});
      });
    });
    return unsub;
  }, []);

  const totalActive = Object.values(roomPresence).reduce((sum, occ) => sum + occ.length, 0);

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6 flex-1">
      <div>
        <h2 className="text-2xl font-light text-foreground">Rooms</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {totalActive > 0
            ? <><span style={{ color: '#22c55e', fontWeight: 600 }}>{totalActive}</span> people working right now</>
            : 'Join a room to work alongside others.'}
        </p>
      </div>

      <div className="flex flex-col gap-4">
          {rooms.map((room) => {
            const occupants: Occupant[] = roomPresence[room.id] || [];
            const isActive = room.id === activeRoomId;

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Room header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className="text-2xl">{room.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium text-foreground">{room.name}</h3>
                      {occupants.length > 0 && (
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#22c55e' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 4px rgba(34,197,94,0.6)' }} />
                          {occupants.length} inside
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{room.description}</p>
                  </div>
                  <button
                    onClick={() => setActiveRoomId(isActive ? null : room.id)}
                    className={`rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                      isActive
                        ? 'bg-foreground text-background'
                        : 'bg-accent text-foreground hover:bg-accent/80'
                    }`}
                    style={{ width: 100, padding: '7px 0', textAlign: 'center' }}
                  >
                    {isActive ? '✓ Joined' : 'Join room'}
                  </button>
                </div>

                {/* Occupants list */}
                {occupants.length > 0 && (
                  <div className="border-t border-border px-5 py-3 flex flex-col gap-2">
                    {occupants.map((occ) => (
                      <div key={occ.user_id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                          {(occ.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-foreground flex-1 truncate">
                          {occ.display_name || 'Someone'}
                        </span>
                        {occ.task && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {occ.task}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {occupants.length === 0 && (
                  <div className="border-t border-border px-5 py-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Users size={12} /> Empty — be the first
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
      </div>

      {activeRoomId && (
        <div className="sticky bottom-0 bg-background pt-2 pb-1">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-accent-fire/30 bg-accent-fire/5">
            <span className="text-sm text-foreground flex-1">
              Room selected: <strong>{rooms.find(r => r.id === activeRoomId)?.name}</strong>
            </span>
            <span className="text-xs text-muted-foreground">
              Start a focus session and your work will be visible in this room.
            </span>
            <button
              onClick={() => setActiveRoomId(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
