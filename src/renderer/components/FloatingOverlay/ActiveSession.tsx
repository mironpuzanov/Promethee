import React, { useState, useEffect, useRef } from 'react';
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
  toggleTaskPanelTrigger?: number;
}

function ActiveSession({ session, onEnd, focusAddFieldTrigger = 0, toggleTaskPanelTrigger = 0 }: ActiveSessionProps) {
  const [elapsed, setElapsed] = useState(0);
  const [xpSoFar, setXpSoFar] = useState(0);
  const [minimized, setMinimized] = useState(true);
  const rafRef = useRef<number>(0);
  const lastSecRef = useRef(-1);

  useEffect(() => {
    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
      // Only update state when the second actually changes — avoids unnecessary renders
      if (elapsedSeconds !== lastSecRef.current) {
        lastSecRef.current = elapsedSeconds;
        setElapsed(elapsedSeconds);
        setXpSoFar(elapsedSeconds < 60 ? 0 : Math.floor(elapsedSeconds / 60) * 10);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [session.startedAt]);

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
      <TaskChecklist
        session={session}
        focusAddFieldTrigger={focusAddFieldTrigger}
        togglePanelTrigger={toggleTaskPanelTrigger}
      />
      <LevelPill xpSoFar={xpSoFar} />
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
