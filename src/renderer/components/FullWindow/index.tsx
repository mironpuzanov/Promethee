import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import Sidebar from './Sidebar';
import CharacterPanel from './CharacterPanel';
import RightPanel from './RightPanel';
import LeaderboardTab from './LeaderboardTab';
import RoomsTab from './RoomsTab';
import SessionCompleteScreen from './SessionCompleteScreen';
import SettingsTab from './SettingsTab';
import MentorTab from './MentorTab';
import QuestsTab from './QuestsTab';
import TasksTab from './TasksTab';
import HabitsTab from './HabitsTab';
import MemoryTab from './MemoryTab';
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
  user_metadata?: { display_name?: string; avatar_url?: string };
}

interface Session {
  id: string;
  task?: string;
  started_at: number;
  duration_seconds?: number;
  xp_earned?: number;
}

interface UpdateState {
  status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'error' | 'development';
  currentVersion: string;
  latestVersion?: string | null;
  checkedAt?: number | null;
  releaseUrl?: string | null;
  downloadUrl?: string | null;
  assetName?: string | null;
  publishedAt?: string | null;
  error?: string | null;
  isSkipped?: boolean;
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function groupByDay<T>(items: T[], getTs: (item: T) => number): { label: string; items: T[] }[] {
  const map = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const label = dayLabel(getTs(item));
    if (!map.has(label)) map.set(label, { label, items: [] });
    map.get(label)!.items.push(item);
  }
  return Array.from(map.values());
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

  const formatTime = (ts?: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const groups = groupByDay(sessions, s => s.started_at);

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6">
      <h2 className="text-2xl font-light text-foreground">Session Log</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet. Start your first session from the overlay.</p>
      ) : (
        <motion.div
          className="flex flex-col gap-6"
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          {groups.map(group => (
            <div key={group.label} className="flex flex-col gap-1">
              <motion.div variants={rowVariants} className="text-xs text-muted-foreground font-medium tracking-wide uppercase px-1 pb-1">
                {group.label}
              </motion.div>
              {group.items.map(s => (
                <motion.div
                  key={s.id}
                  variants={rowVariants}
                  className="flex justify-between items-center px-4 py-3 rounded-lg bg-card hover:bg-accent transition-colors gap-4"
                >
                  <span className="text-sm text-foreground flex-1 truncate">{s.task || 'Untitled session'}</span>
                  <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
                    <span>{formatTime(s.started_at)}</span>
                    <span>{formatDuration(s.duration_seconds)}</span>
                    <span className="flex items-center gap-1 text-accent-orange font-medium">
                      <Zap size={11} />
                      {s.xp_earned || 0} XP
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

interface FullWindowProps {
  user: User | null;
  setUser: (user: User | null) => void;
}

function FullWindow({ user, setUser }: FullWindowProps) {
  const [activeTab, setActiveTab] = useState('home');
  const [completedSession, setCompletedSession] = useState<{
    task: string;
    durationSeconds: number;
    xpEarned: number;
    multiplier?: number;
    streakBonus?: number;
    depthBonus?: number;
    currentStreak?: number;
    sessionId?: string;
  } | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '—',
  });
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | null>(null);

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

  useEffect(() => {
    window.promethee.update.getState().then(setUpdateState);
    const unsub = window.promethee.update.onStatus(setUpdateState);
    return unsub;
  }, []);

  const renderMain = () => {
    switch (activeTab) {
      case 'home':        return <CharacterPanel user={user} />;
      case 'log':         return <SessionLog />;
      case 'tasks':       return <TasksTab />;
      case 'leaderboard': return <LeaderboardTab />;
      case 'rooms':       return <RoomsTab />;
      case 'quests':      return <QuestsTab />;
      case 'habits':      return <HabitsTab />;
      case 'memory':      return <MemoryTab />;
      case 'mentor':      return <MentorTab />;
      case 'settings':    return <SettingsTab user={user} setUser={setUser} />;
      default:        return <CharacterPanel user={user} />;
    }
  };

  const isHome = activeTab === 'home';
  const showRightPanel = activeTab === 'home';
  const showUpdatePrompt =
    updateState.status === 'available' &&
    !updateState.isSkipped &&
    updateState.latestVersion !== dismissedUpdateVersion;

  // Session complete: show ONLY the completion screen, no dashboard behind it
  if (completedSession) {
    return (
      <SessionCompleteScreen
        task={completedSession.task}
        durationSeconds={completedSession.durationSeconds}
        xpEarned={completedSession.xpEarned}
        multiplier={completedSession.multiplier}
        streakBonus={completedSession.streakBonus}
        depthBonus={completedSession.depthBonus}
        currentStreak={completedSession.currentStreak}
        sessionId={completedSession.sessionId}
        onClose={() => setCompletedSession(null)}
      />
    );
  }

  return (
    <div className={`full-window${isHome ? '' : ' no-right-panel'}`}>
      <div className="titlebar-drag" />
      {showUpdatePrompt && (
        <div className="pointer-events-none fixed top-14 left-1/2 z-[120] -translate-x-1/2 w-[420px]">
          <div style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--border-color)', boxShadow: '0 20px 56px rgba(0,0,0,0.45)', overflow: 'hidden' }} className="pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Promethee v{updateState.latestVersion} is available
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  You're on v{updateState.currentVersion}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissedUpdateVersion(updateState.latestVersion || null)}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            {/* Steps */}
            <div className="px-5 py-3 flex flex-col gap-2">
              {[
                'Download the new version below',
                'Quit Promethee (⌘Q)',
                'Open the downloaded DMG and drag Promethee to Applications',
                'Reopen Promethee',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
            {/* Action */}
            <div className="px-5 pb-4 pt-1">
              <button
                type="button"
                onClick={() => void window.promethee.update.openDownload()}
                className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Download v{updateState.latestVersion}
              </button>
            </div>
          </div>
        </div>
      )}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      {renderMain()}
      {showRightPanel && <RightPanel />}
    </div>
  );
}

export default FullWindow;
