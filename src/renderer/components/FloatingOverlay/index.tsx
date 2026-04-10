import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import IdleBar from './IdleBar';
import ActiveSession from './ActiveSession';
import AgentBubble from './AgentBubble';
import RoomsPanel from './RoomsPanel';
import { useAudio } from '../../hooks/useAudio';
import { overlayInstallPointerSync } from '../../lib/overlayMouseBridge';
import { MVP_MODE } from '../../../config/mvp';
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
  const [agentOpenTrigger] = useState(0);
  const [agentToggleTrigger, setAgentToggleTrigger] = useState(0);
  const [taskShortcutTrigger] = useState(0);
  const [taskToggleTrigger, setTaskToggleTrigger] = useState(0);
  const [blockerState, setBlockerState] = useState<'active' | 'unavailable' | 'not-installed' | 'inactive'>('inactive');
  const { transitionTo } = useAudio();
  const activeSessionRef = useRef<Session | null>(null);
  const handleEndSessionRef = useRef<() => Promise<void>>(async () => {});

  // Audio: start dashboard ambient when idle. Defer by 3s on mount so that
  // if the full window fails to appear (first launch edge case, PRO-14) the
  // user isn't hit with unexplained music before any UI is visible.
  // Check the ref at fire time — user may have started a session in those 3s.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!activeSessionRef.current) transitionTo('dashboard');
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => overlayInstallPointerSync(), []);

  useEffect(() => {
    window.promethee.session.getActive().then((result: { success: boolean; session?: Session }) => {
      if (result.success && result.session) {
        setActiveSession(result.session);
      }
    });

    const unsubSuspend = window.promethee.power.onSuspend((endedSession: unknown) => {
      // Session was ended+synced before sleep — clear active state
      if (endedSession) setActiveSession(null);
    });
    const unsubResume = window.promethee.power.onResume(() => setShowResumePrompt(true));

    const unsubFocus = window.promethee.window.onFocusTaskInput((data: { roomId: string | null }) => {
      if (data.roomId) setSelectedRoomId(data.roomId);
      setFocusTaskInput(true);
    });
    const unsubBlocker = window.promethee.blocker.onStatus((data) => setBlockerState(data.state));
    return () => { unsubSuspend(); unsubResume(); unsubFocus(); unsubBlocker(); };
  }, []);

  const handleStartSession = async (task: string, roomId?: string | null) => {
    const room = roomId ?? selectedRoomId ?? null;
    const result = await window.promethee.session.start(task, room);
    if (result.success) {
      setActiveSession({ ...result.session, roomId: room });
      setSelectedRoomId(null);
      transitionTo('session-active'); // Prestige Fade lingers then fades out
    } else {
      console.error('Failed to start session:', result.error);
      alert(result.error);
    }
  };

  const handleEndSession = useCallback(async () => {
    try {
      const result = await window.promethee.session.end();
      if (result.success) {
        setActiveSession(null);
        transitionTo('dashboard');
        if (result.session) {
          window.promethee.window.openSessionComplete({
            task: result.session.task || 'Session',
            durationSeconds: result.session.durationSeconds || 0,
            xpEarned: result.session.xpEarned || 0,
            multiplier: result.session.multiplier,
            streakBonus: result.session.streakBonus,
            depthBonus: result.session.depthBonus,
            currentStreak: result.session.currentStreak,
            sessionId: result.session.id,
          });
        }
      } else {
        console.error('Failed to end session:', result.error);
        alert(result.error || 'Could not end session.');
      }
    } catch (e) {
      console.error('session.end failed:', e);
      alert(e instanceof Error ? e.message : 'Could not end session.');
    }
  }, [transitionTo]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    handleEndSessionRef.current = handleEndSession;
  }, [handleEndSession]);

  useEffect(() => {
    const unsub = window.promethee.shortcuts.onFocusShortcut((action) => {
      if (action === 'openMentor') setAgentToggleTrigger((n) => n + 1);
      if (action === 'focusAddTask' && activeSessionRef.current) setTaskToggleTrigger((n) => n + 1);
      if (action === 'endSession' && activeSessionRef.current) void handleEndSessionRef.current();
    });
    return unsub;
  }, []);

  const handleDismissResumePrompt = () => {
    setShowResumePrompt(false);
  };

  if (showResumePrompt) {
    return (
      <div className="floating-overlay">
        <div className="resume-prompt promethee-mouse-target">
          <p>Welcome back. Ready to focus?</p>
          <button onClick={handleDismissResumePrompt}>Got it</button>
        </div>
        <AgentBubble activeSession={null} openTrigger={agentOpenTrigger} toggleTrigger={agentToggleTrigger} />
      </div>
    );
  }

  if (activeSession) {
    return (
      <>
        <ActiveSession
          session={activeSession}
          onEnd={handleEndSession}
          focusAddFieldTrigger={taskShortcutTrigger}
          toggleTaskPanelTrigger={taskToggleTrigger}
        />
        <AgentBubble activeSession={activeSession} openTrigger={agentOpenTrigger} toggleTrigger={agentToggleTrigger} />
        {!MVP_MODE && blockerState === 'active' && (
          <div
            style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/60 text-[11px] promethee-mouse-ignore"
          >
            <span>🛡</span>
            <span>Sites blocked</span>
          </div>
        )}
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
        onOpenMentor={() => setAgentToggleTrigger(n => n + 1)}
        onSessionStartIntent={() => transitionTo('session-active')}
      />
      <AgentBubble activeSession={null} openTrigger={agentOpenTrigger} toggleTrigger={agentToggleTrigger} />
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
