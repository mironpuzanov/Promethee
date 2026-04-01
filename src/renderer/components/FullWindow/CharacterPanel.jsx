import React, { useState, useEffect } from 'react';
import './CharacterPanel.css';

function CharacterPanel({ user }) {
  const userName = user?.email?.split('@')[0] || 'Guest';
  const [profile, setProfile] = useState({ total_xp: 0, level: 1 });

  useEffect(() => {
    window.promethee.db.getUserProfile().then(result => {
      if (result.success && result.profile) {
        setProfile(result.profile);
      }
    });
  }, []);

  const totalXP = profile.total_xp || 0;
  const level = profile.level || 1;
  const tier = 'Apprentice';
  const xpForNextLevel = level * 100;

  const skills = [
    { name: 'Willpower', value: 4 },
    { name: 'Discipline', value: 2 },
    { name: 'Rigor', value: 1 }
  ];

  const xpDots = Array.from({ length: 12 }, (_, i) => i < Math.floor((totalXP / xpForNextLevel) * 12));

  return (
    <div className="character-panel">
      <div className="character-header">
        <h1 className="character-name">{userName}</h1>
        <p className="character-level">Level {level} · {tier}</p>
        <div className="xp-bar">
          {xpDots.map((filled, i) => (
            <span key={i} className={`xp-dot ${filled ? 'filled' : ''}`}>█</span>
          ))}
          <span className="xp-text">{totalXP} XP</span>
        </div>
      </div>

      <div className="character-silhouette">
        <svg width="200" height="300" viewBox="0 0 200 300">
          <ellipse cx="100" cy="60" rx="40" ry="50" fill="var(--text-faint)" opacity="0.3" />
          <rect x="60" y="110" width="80" height="120" rx="10" fill="var(--text-faint)" opacity="0.3" />
          <rect x="40" y="120" width="20" height="80" rx="10" fill="var(--text-faint)" opacity="0.3" />
          <rect x="140" y="120" width="20" height="80" rx="10" fill="var(--text-faint)" opacity="0.3" />
          <rect x="70" y="230" width="25" height="60" rx="10" fill="var(--text-faint)" opacity="0.3" />
          <rect x="105" y="230" width="25" height="60" rx="10" fill="var(--text-faint)" opacity="0.3" />
        </svg>
      </div>

      <div className="skills-list">
        {skills.map(skill => (
          <div key={skill.name} className="skill-item">
            <span className="skill-name">{skill.name}</span>
            <span className="skill-value">{skill.value}</span>
          </div>
        ))}
      </div>

      <div className="habits-section">
        <h3 className="section-title">Habits</h3>
        <div className="habits-chart">
          <svg width="100%" height="100" viewBox="0 0 300 100">
            <line x1="0" y1="25" x2="300" y2="25" stroke="#333" strokeWidth="1" />
            <line x1="0" y1="50" x2="300" y2="50" stroke="#333" strokeWidth="1" />
            <line x1="0" y1="75" x2="300" y2="75" stroke="#333" strokeWidth="1" />
            <polyline
              points="0,80 60,60 120,50 180,40 240,30 300,25"
              fill="none"
              stroke="var(--accent-orange)"
              strokeWidth="2"
              opacity="0.5"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default CharacterPanel;
