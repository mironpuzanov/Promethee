import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import IdleBar from './IdleBar';
import ActiveSession from './ActiveSession';
import AgentBubble from './AgentBubble';
import RoomsPanel from './RoomsPanel';
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
  roomId?: string | null;
}

interface FloatingOverlayProps {
  user: User | null;
  setUser: (user: User | null) => void;
}

function FloatingOverlay({ user, setUser }: FloatingOverlayProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showRooms, setShowRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [focusTaskInput, setFocusTaskInput] = useState(false);
  const [agentOpenTrigger, setAgentOpenTrigger] = useState(0);

  useEffect(() => {
    window.promethee.session.getActive().then((result: { success: boolean; session?: Session }) => {
      if (result.success && result.session) {
        setActiveSession(result.session);
      }
    });

    window.promethee.power.onSuspend(() => {});
    window.promethee.power.onResume(() => setShowResumePrompt(true));

    const unsub = window.promethee.window.onFocusTaskInput((data: { roomId: string | null }) => {
      if (data.roomId) setSelectedRoomId(data.roomId);
      setFocusTaskInput(true);
    });
    return unsub;
  }, []);

  const handleStartSession = async (task: string, roomId?: string | null) => {
    const room = roomId ?? selectedRoomId ?? null;
    const result = await window.promethee.session.start(task, room);
    if (result.success) {
      setActiveSession({ ...result.session, roomId: room });
      setSelectedRoomId(null);
    } else {
      console.error('Failed to start session:', result.error);
      alert(result.error);
    }
  };

  const handleEndSession = async () => {
    const result = await window.promethee.session.end();
    if (result.success && result.session) {
      setActiveSession(null);
      // Open dashboard with session complete screen
      window.promethee.window.openSessionComplete({
        task: result.session.task || 'Session',
        durationSeconds: result.session.durationSeconds || 0,
        xpEarned: result.session.xpEarned || 0,
      });
    } else if (!result.success) {
      console.error('Failed to end session:', result.error);
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
        <AgentBubble activeSession={activeSession} />
      </div>
    );
  }

  if (activeSession) {
    return (
      <>
        <ActiveSession session={activeSession} onEnd={handleEndSession} />
        <AgentBubble activeSession={activeSession} />
      </>
    );
  }

  return (
    <>
      <IdleBar
        user={user}
        onStartSession={handleStartSession}
        onOpenRooms={() => setShowRooms(r => !r)}
        autoFocusInput={focusTaskInput}
        onAutoFocusConsumed={() => setFocusTaskInput(false)}
        onOpenMentor={() => setAgentOpenTrigger(n => n + 1)}
      />
      <AgentBubble activeSession={null} openTrigger={agentOpenTrigger} />
      <AnimatePresence>
        {showRooms && (
          <RoomsPanel
            onClose={() => setShowRooms(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingOverlay;
