import React, { useState, useEffect } from 'react';
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
}

function ActiveSession({ session, onEnd }: ActiveSessionProps) {
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

  // Ensure mouse passthrough when component mounts/unmounts
  useEffect(() => {
    window.promethee.window.setIgnoreMouseEvents(true);
    return () => {
      window.promethee.window.setIgnoreMouseEvents(true);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="active-session">
      <TaskChecklist session={session} />
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
