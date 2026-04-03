import React, { useState, useEffect } from 'react';
import { getLevelInfo } from '../../../lib/xp';
import './LevelPill.css';

function LevelPill() {
  const [totalXP, setTotalXP] = useState(0);

  useEffect(() => {
    window.promethee.db.getUserProfile().then((result: { success: boolean; profile?: { total_xp: number } }) => {
      if (result.success && result.profile) {
        setTotalXP(result.profile.total_xp || 0);
      }
    });
  }, []);

  const { level, tier, xpIntoLevel, xpForCurrentLevel } = getLevelInfo(totalXP);
  const filled = Math.round((xpIntoLevel / xpForCurrentLevel) * 5);
  const dots = Array.from({ length: 5 }, (_, i) => i < filled);

  return (
    <div className="level-pill">
      <span className="level-text">Level {level} · {tier}</span>
      <div className="xp-dots">
        {dots.map((f, i) => (
          <span key={i} className={`dot ${f ? 'filled' : ''}`} />
        ))}
      </div>
    </div>
  );
}

export default LevelPill;
