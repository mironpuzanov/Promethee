import React from 'react';
import './LevelPill.css';

function LevelPill() {
  // Hardcoded for prototype
  const level = 1;
  const tier = 'Apprentice';
  const xpProgress = [true, true, false, false, false]; // 2 of 5 dots filled

  return (
    <div className="level-pill">
      <span className="level-text">Level {level} · {tier}</span>
      <div className="xp-dots">
        {xpProgress.map((filled, i) => (
          <span key={i} className={`dot ${filled ? 'filled' : ''}`}>·</span>
        ))}
      </div>
    </div>
  );
}

export default LevelPill;
