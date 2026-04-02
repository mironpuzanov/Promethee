import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Room {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface RoomsPanelProps {
  onClose: () => void;
  onJoinRoom: (roomId: string) => void;
  activeRoomId?: string | null;
}

const STATIC_ROOMS: Room[] = [
  { id: 'deep-work', name: 'Deep Work', description: 'No distractions. Build serious things.', icon: '🔥' },
  { id: 'study',     name: 'Study',     description: 'Learning mode. Books open, brain on.',   icon: '📚' },
  { id: 'creative',  name: 'Creative',  description: 'Design, writing, music, art.',            icon: '🎨' },
];

function RoomsPanel({ onClose, onJoinRoom, activeRoomId }: RoomsPanelProps) {
  const [rooms, setRooms] = useState<Room[]>(STATIC_ROOMS);
  const [roomPresence, setRoomPresence] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.promethee.presence.getRooms().then((result) => {
      if (result.success) {
        if (result.rooms && result.rooms.length > 0) setRooms(result.rooms);
        setRoomPresence(result.roomPresence || {});
      }
    });
  }, []);

  const handleMouseEnter = () => window.promethee.window.setIgnoreMouseEvents(false);
  const handleMouseLeave = () => window.promethee.window.setIgnoreMouseEvents(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        bottom: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(14,14,14,0.97)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '16px',
        minWidth: 280,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Rooms
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#555', cursor: 'pointer',
            fontSize: 16, padding: '0 2px', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rooms.map((room) => {
            const occupants = roomPresence[room.id] || [];
            const isActive = room.id === activeRoomId;

            return (
              <button
                key={room.id}
                onClick={() => { onJoinRoom(room.id); onClose(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{room.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{room.name}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{room.description}</div>
                </div>
                {occupants.length > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 4px rgba(34,197,94,0.5)',
                    }} />
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>
                      {occupants.length}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10, padding: '8px 4px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: 11, color: '#444', margin: 0, lineHeight: 1.4 }}>
          Join a room when you start a session to connect with others doing the same kind of work.
        </p>
      </div>
    </motion.div>
  );
}

export default RoomsPanel;
