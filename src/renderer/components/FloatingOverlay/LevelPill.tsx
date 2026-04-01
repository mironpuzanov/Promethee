import React from 'react';
import './LevelPill.css';

interface LevelPillProps {
  level?: number;
  tier?: string;
  totalXP?: number;
  xpForNextLevel?: number;
}

function LevelPill({ level = 1, tier = 'Apprentice', totalXP = 0, xpForNextLevel = 100 }: LevelPillProps) {
  const filled = Math.round((totalXP / xpForNextLevel) * 5);
  const xpProgress = Array.from({ length: 5 }, (_, i) => i < filled);

  return (
    <div className="level-pill">
      <span className="level-text">Level {level} · {tier}</span>
      <div className="xp-dots">
        {xpProgress.map((f, i) => (
          <span key={i} className={`dot ${f ? 'filled' : ''}`}>·</span>
        ))}
      </div>
    </div>
  );
}

export default LevelPill;
