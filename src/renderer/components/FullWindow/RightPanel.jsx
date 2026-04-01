import React, { useState, useEffect } from 'react';
import './RightPanel.css';

function RightPanel({ user }) {
  const [todayStats, setTodayStats] = useState({ hours: 0, xp: 0, rank: null });

  useEffect(() => {
    // Fetch today's sessions
    window.promethee.session.getToday().then(result => {
      if (result.success && result.sessions) {
        const totalSeconds = result.sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
        const totalXP = result.sessions.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
        const hours = (totalSeconds / 3600).toFixed(1);

        setTodayStats({ hours, xp: totalXP, rank: null });
      }
    });
  }, []);

  const quests = [
    { id: 1, title: 'Build prototype', completed: false },
    { id: 2, title: 'Ship before Paris', completed: false }
  ];

  const titles = [
    { name: 'Builder', progress: 75 },
    { name: 'Focused', progress: 25 }
  ];

  return (
    <div className="right-panel">
      <div className="search-box">
        <input type="text" placeholder="Search..." />
      </div>

      <div className="panel-section">
        <h3 className="section-title">Active Quest</h3>
        <div className="quest-list">
          {quests.map(quest => (
            <div key={quest.id} className="quest-item">
              <input
                type="checkbox"
                checked={quest.completed}
                onChange={() => {}}
              />
              <span>{quest.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3 className="section-title">Titles</h3>
        <div className="titles-list">
          {titles.map(title => (
            <div key={title.name} className="title-item">
              <div className="title-header">
                <span className="title-name">{title.name}</span>
                <span className="title-progress">{title.progress}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${title.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3 className="section-title">Today</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{todayStats.hours}h</div>
            <div className="stat-label">Time</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{todayStats.xp} XP</div>
            <div className="stat-label">Earned</div>
          </div>
          {todayStats.rank && (
            <div className="stat-item">
              <div className="stat-value">#{todayStats.rank}</div>
              <div className="stat-label">Rank</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RightPanel;
