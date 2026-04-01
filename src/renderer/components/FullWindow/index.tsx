import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import CharacterPanel from './CharacterPanel';
import RightPanel from './RightPanel';
import './FullWindow.css';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string };
}

interface Session {
  id: string;
  task?: string;
  started_at: number;
  duration_seconds?: number;
  xp_earned?: number;
}

function SessionLog() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    window.promethee.db.getSessions().then((result: { success: boolean; sessions?: Session[] }) => {
      if (result.success) setSessions(result.sessions || []);
    });
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  const formatDate = (ts?: number) => {
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

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="tab-panel">
      <h2 className="tab-title">{title}</h2>
      <p className="tab-empty">Coming soon.</p>
    </div>
  );
}

interface FullWindowProps {
  user: User | null;
  setUser: (user: User | null) => void;
}

function FullWindow({ user, setUser }: FullWindowProps) {
  const [activeTab, setActiveTab] = useState('home');

  const renderMain = () => {
    switch (activeTab) {
      case 'home':    return <CharacterPanel user={user} />;
      case 'log':     return <SessionLog />;
      case 'quests':  return <PlaceholderTab title="Quests" />;
      case 'habits':  return <PlaceholderTab title="Habits" />;
      case 'skills':  return <PlaceholderTab title="Skills" />;
      case 'journal': return <PlaceholderTab title="Journal" />;
      case 'mentor':  return <PlaceholderTab title="Mentor" />;
      default:        return <CharacterPanel user={user} />;
    }
  };

  const isHome = activeTab === 'home';

  return (
    <div className={`full-window${isHome ? '' : ' no-right-panel'}`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      {renderMain()}
      {isHome && <RightPanel />}
    </div>
  );
}

export default FullWindow;
