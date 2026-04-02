import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import Sidebar from './Sidebar';
import CharacterPanel from './CharacterPanel';
import RightPanel from './RightPanel';
import LeaderboardTab from './LeaderboardTab';
import RoomsTab from './RoomsTab';
import SessionCompleteScreen from './SessionCompleteScreen';
import './FullWindow.css';

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
};

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
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6">
      <h2 className="text-2xl font-light text-foreground">Session Log</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet. Start your first session from the overlay.</p>
      ) : (
        <motion.div
          className="flex flex-col gap-1"
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          {sessions.map(s => (
            <motion.div
              key={s.id}
              variants={rowVariants}
              className="flex justify-between items-center px-4 py-3 rounded-lg bg-card hover:bg-accent transition-colors gap-4"
            >
              <span className="text-sm text-foreground flex-1 truncate">{s.task || 'Untitled session'}</span>
              <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
                <span>{formatDate(s.started_at)}</span>
                <span>{formatDuration(s.duration_seconds)}</span>
                <span className="flex items-center gap-1 text-accent-orange font-medium">
                  <Zap size={11} />
                  {s.xp_earned || 0} XP
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6">
      <h2 className="text-2xl font-light text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}

interface FullWindowProps {
  user: User | null;
  setUser: (user: User | null) => void;
}

function FullWindow({ user, setUser }: FullWindowProps) {
  const [activeTab, setActiveTab] = useState('home');
  const [completedSession, setCompletedSession] = useState<{ task: string; durationSeconds: number; xpEarned: number } | null>(null);

  useEffect(() => {
    // Check if main process has a pending session complete from before this window mounted
    window.promethee.window.getPendingSessionComplete().then((data) => {
      if (data) setCompletedSession(data);
    });

    // Also listen for direct sends (when window was already open)
    const unsub = window.promethee.window.onSessionComplete((data) => {
      setCompletedSession(data);
    });
    return unsub;
  }, []);

  const renderMain = () => {
    switch (activeTab) {
      case 'home':        return <CharacterPanel user={user} />;
      case 'log':         return <SessionLog />;
      case 'leaderboard': return <LeaderboardTab />;
      case 'rooms':       return <RoomsTab />;
      case 'quests':      return <PlaceholderTab title="Quests" />;
      case 'habits':      return <PlaceholderTab title="Habits" />;
      case 'skills':      return <PlaceholderTab title="Skills" />;
      case 'journal':     return <PlaceholderTab title="Journal" />;
      case 'mentor':      return <PlaceholderTab title="Mentor" />;
      default:        return <CharacterPanel user={user} />;
    }
  };

  const isHome = activeTab === 'home';
  const showRightPanel = activeTab === 'home';

  // Session complete: show ONLY the completion screen, no dashboard behind it
  if (completedSession) {
    return (
      <SessionCompleteScreen
        task={completedSession.task}
        durationSeconds={completedSession.durationSeconds}
        xpEarned={completedSession.xpEarned}
        onClose={() => setCompletedSession(null)}
      />
    );
  }

  return (
    <div className={`full-window${isHome ? '' : ' no-right-panel'}`}>
      <div className="titlebar-drag" />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      {renderMain()}
      {showRightPanel && <RightPanel />}
    </div>
  );
}

export default FullWindow;
