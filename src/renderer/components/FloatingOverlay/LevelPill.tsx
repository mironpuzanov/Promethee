import React, { useState, useEffect, useRef } from 'react';
import { getLevelInfo } from '../../../lib/xp';
import './LevelPill.css';

interface LevelPillProps {
  xpSoFar?: number;
}

function LevelPill({ xpSoFar = 0 }: LevelPillProps) {
  const [baseXP, setBaseXP] = useState(0);
  const [floats, setFloats] = useState<{ id: number }[]>([]);
  const prevXpSoFar = useRef(0);
  const floatId = useRef(0);

  useEffect(() => {
    window.promethee.db.getUserProfile().then((result: { success: boolean; profile?: { total_xp: number } }) => {
      if (result.success && result.profile) {
        setBaseXP(result.profile.total_xp || 0);
      }
    });
  }, []);

  // Fire +XP float only when xpSoFar crosses a new 10-XP threshold
  useEffect(() => {
    if (xpSoFar > 0 && xpSoFar > prevXpSoFar.current && xpSoFar % 10 === 0) {
      const id = floatId.current++;
      setFloats(f => [...f, { id }]);
      setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 1200);
    }
    prevXpSoFar.current = xpSoFar;
  }, [xpSoFar]);

  const liveXP = baseXP + xpSoFar;
  const { level, tier, xpIntoLevel, xpForCurrentLevel } = getLevelInfo(liveXP);
  const progress = Math.min(xpIntoLevel / xpForCurrentLevel, 1);

  return (
    <div className="level-pill promethee-mouse-target">
      <span className="level-text">Lv {level} · {tier}</span>

      <div className="level-pill__bar-track">
        <div className="level-pill__bar-fill" style={{ width: `${progress * 100}%` }} />
        {[20, 40, 60, 80].map(pct => (
          <div key={pct} className="level-pill__bar-divider" style={{ left: `${pct}%` }} />
        ))}
      </div>

      <span className="level-pill__session-xp">+{xpSoFar} XP</span>

      {floats.map(({ id }) => (
        <span key={id} className="level-pill__xp-float">+10 XP</span>
      ))}
    </div>
  );
}

export default LevelPill;
