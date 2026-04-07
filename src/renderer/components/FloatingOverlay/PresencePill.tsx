import React, { useState, useEffect } from 'react';

interface PresencePillProps {
  onClick?: () => void;
}

function PresencePill({ onClick }: PresencePillProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // Initial fetch
    window.promethee.presence.getCount().then((result) => {
      if (result.success && result.count !== undefined) {
        setCount(result.count);
      }
    });

    // Live updates from polling interval
    const unsub = window.promethee.presence.onCount((c) => {
      setCount(c);
    });

    return unsub;
  }, []);

  if (count === null || count === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="promethee-mouse-target"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '3px 10px 3px 7px',
        cursor: onClick ? 'pointer' : 'default',
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#22c55e',
        flexShrink: 0,
        boxShadow: '0 0 6px rgba(34,197,94,0.6)',
        animation: 'presencePulse 2.5s ease-in-out infinite',
      }} />
      {count} working
    </button>
  );
}

export default PresencePill;
