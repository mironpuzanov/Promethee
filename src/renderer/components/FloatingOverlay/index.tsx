import React, { useState, useEffect } from 'react';
import IdleBar from './IdleBar';
import ActiveSession from './ActiveSession';
import './FloatingOverlay.css';

interface User {
  id: string;
  email: string;
}

interface Session {
  id: string;
  task?: string;
  startedAt: number;
  userId?: string;
}

interface FloatingOverlayProps {
  user: User | null;
  setUser: (user: User | null) => void;
}

function FloatingOverlay({ user, setUser }: FloatingOverlayProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  useEffect(() => {
    window.promethee.session.getActive().then((result: { success: boolean; session?: Session }) => {
      if (result.success && result.session) {
        setActiveSession(result.session);
      }
    });

    window.promethee.power.onSuspend(() => {});
    window.promethee.power.onResume(() => setShowResumePrompt(true));
  }, []);

  const handleStartSession = async (task: string) => {
    const result = await window.promethee.session.start(task);
    if (result.success) {
      setActiveSession(result.session);
    } else {
      console.error('Failed to start session:', result.error);
      alert(result.error);
    }
  };

  const handleEndSession = async () => {
    const result = await window.promethee.session.end();
    if (result.success) {
      setActiveSession(null);
      if (result.session?.xpEarned > 0) {
        alert(`Session complete! +${result.session.xpEarned} XP`);
      }
    } else {
      console.error('Failed to end session:', result.error);
      alert(result.error);
    }
  };

  const handleResumeSession = (resume: boolean) => {
    setShowResumePrompt(false);
    if (!resume) setActiveSession(null);
  };

  if (showResumePrompt) {
    return (
      <div
        className="floating-overlay"
        onMouseEnter={() => window.promethee.window.setIgnoreMouseEvents(false)}
        onMouseLeave={() => window.promethee.window.setIgnoreMouseEvents(true)}
      >
        <div className="resume-prompt">
          <p>Resume session?</p>
          <button onClick={() => handleResumeSession(true)}>Yes</button>
          <button onClick={() => handleResumeSession(false)}>No</button>
        </div>
      </div>
    );
  }

  if (activeSession) {
    return <ActiveSession session={activeSession} onEnd={handleEndSession} />;
  }

  return <IdleBar user={user} onStartSession={handleStartSession} />;
}

export default FloatingOverlay;
