import React, { useState, useEffect } from 'react';
import { overlaySetFocusSessionActive } from '../../lib/overlayMouseBridge';
import LevelPill from './LevelPill';
import TimerCard from './TimerCard';
import TaskChecklist from './TaskChecklist';
import './ActiveSession.css';

interface Session {
  id: string;
  task?: string;
  startedAt: number;
  userId?: string;
}

interface ActiveSessionProps {
  session: Session;
  onEnd: () => void;
  focusAddFieldTrigger?: number;
}

function ActiveSession({ session, onEnd, focusAddFieldTrigger = 0 }: ActiveSessionProps) {
  const [elapsed, setElapsed] = useState(0);
  const [xpSoFar, setXpSoFar] = useState(0);
  const [minimized, setMinimized] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - session.startedAt) / 1000);
      setElapsed(elapsedSeconds);
      const xp = elapsedSeconds < 60 ? 0 : Math.floor(elapsedSeconds / 60) * 10;
      setXpSoFar(xp);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    overlaySetFocusSessionActive(true);
    return () => overlaySetFocusSessionActive(false);
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="active-session">
      <TaskChecklist session={session} focusAddFieldTrigger={focusAddFieldTrigger} />
      <LevelPill />
      <TimerCard
        elapsed={formatTime(elapsed)}
        elapsedSeconds={elapsed}
        task={session.task || 'Working...'}
        xpSoFar={xpSoFar}
        onStop={onEnd}
        minimized={minimized}
        onToggleMinimize={() => setMinimized(m => !m)}
      />
    </div>
  );
}

export default ActiveSession;
