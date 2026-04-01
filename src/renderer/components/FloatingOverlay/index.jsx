import React, { useState, useEffect } from 'react';
import IdleBar from './IdleBar';
import ActiveSession from './ActiveSession';
import './FloatingOverlay.css';

function FloatingOverlay({ user, setUser }) {
  const [activeSession, setActiveSession] = useState(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  useEffect(() => {
    // Check if there's an active session
    window.promethee.session.getActive().then(result => {
      if (result.success && result.session) {
        setActiveSession(result.session);
      }
    });

    // Listen for power events
    window.promethee.power.onSuspend((pausedSession) => {
      console.log('Power suspended, paused session:', pausedSession);
    });

    window.promethee.power.onResume(() => {
      setShowResumePrompt(true);
    });
  }, []);

  const handleStartSession = async (task) => {
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
      // Show XP earned notification
      if (result.session?.xpEarned > 0) {
        alert(`Session complete! You earned ${result.session.xpEarned} XP`);
      }
    } else {
      console.error('Failed to end session:', result.error);
      alert(result.error);
    }
  };

  const handleResumeSession = (resume) => {
    setShowResumePrompt(false);
    if (!resume) {
      setActiveSession(null);
    }
  };

  if (showResumePrompt) {
    return (
      <div className="floating-overlay">
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
