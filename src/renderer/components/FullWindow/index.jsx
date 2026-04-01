import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import CharacterPanel from './CharacterPanel';
import RightPanel from './RightPanel';
import './FullWindow.css';

function SessionLog() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    window.promethee.db.getSessions().then(result => {
      if (result.success) setSessions(result.sessions || []);
    });
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="tab-panel">
      <h2 className="tab-title">Session Log</h2>
      {sessions.length === 0 ? (
        <p className="tab-empty">No sessions yet. Start your first session from the overlay.</p>
      ) : (
        <div className="session-list">
          {sessions.map(s => (
            <div key={s.id} className="session-row">
              <div className="session-task">{s.task || 'Untitled session'}</div>
              <div className="session-meta">
                <span>{formatDate(s.started_at)}</span>
                <span>{formatDuration(s.duration_seconds)}</span>
                <span className="session-xp">+{s.xp_earned || 0} XP</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ title }) {
  return (
    <div className="tab-panel">
      <h2 className="tab-title">{title}</h2>
      <p className="tab-empty">Coming soon.</p>
    </div>
  );
}

function FullWindow({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('home');

  const renderMain = () => {
    switch (activeTab) {
      case 'home':
        return <CharacterPanel user={user} />;
      case 'log':
        return <SessionLog />;
      case 'quests':
        return <PlaceholderTab title="Quests" />;
      case 'habits':
        return <PlaceholderTab title="Habits" />;
      case 'skills':
        return <PlaceholderTab title="Skills" />;
      case 'journal':
        return <PlaceholderTab title="Journal" />;
      case 'mentor':
        return <PlaceholderTab title="Mentor" />;
      default:
        return <CharacterPanel user={user} />;
    }
  };

  const isHome = activeTab === 'home';

  return (
    <div className={`full-window${isHome ? '' : ' no-right-panel'}`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      {renderMain()}
      {isHome && <RightPanel user={user} />}
    </div>
  );
}

export default FullWindow;
