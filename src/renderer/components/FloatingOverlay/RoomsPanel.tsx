import React from 'react';
import { motion } from 'framer-motion';

interface RoomsPanelProps {
  onClose: () => void;
}

const ROOMS = [
  {
    id: '50-10',
    name: '50/10',
    description: '50 min work · 10 min rest',
    discordUrl: 'https://discord.com/channels/1168978580034826290/1324423491717693460',
  },
  {
    id: '25-5',
    name: '25/5',
    description: '25 min work · 5 min rest',
    discordUrl: 'https://discord.com/channels/1168978580034826290/1324423435304046684',
  },
  {
    id: 'raid',
    name: 'Raid',
    description: 'Long sessions, no mercy.',
    discordUrl: 'https://discord.com/channels/1168978580034826290/1473580876138025002',
  },
  {
    id: 'pause-cafe',
    name: 'Pause café',
    description: 'Chill, recharge, come back stronger.',
    discordUrl: 'https://discord.com/channels/1168978580034826290/1275368630090989621',
  },
];

function RoomsPanel({ onClose }: RoomsPanelProps) {
  const openDiscord = (url: string) => {
    window.promethee.window.openExternal(url);
    onClose();
  };

  return (
    <motion.div
      className="promethee-mouse-target"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
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
          Rooms — La Guilde
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ROOMS.map(room => (
          <button
            key={room.id}
            onClick={() => openDiscord(room.discordUrl)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '10px 12px',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{room.name}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{room.description}</div>
            </div>
            {/* Discord icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865F2" style={{ flexShrink: 0, opacity: 0.7 }}>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 10, padding: '8px 4px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: 11, color: '#444', margin: 0, lineHeight: 1.4 }}>
          Opens Discord directly in the room. Join, mute yourself, and work alongside the community.
        </p>
      </div>
    </motion.div>
  );
}

export default RoomsPanel;
