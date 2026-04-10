import React, { useState, useEffect, useRef } from 'react';
import PresencePill from './PresencePill';
import './IdleBar.css';

interface User {
  id: string;
  email: string;
  user_metadata?: { avatar_url?: string; display_name?: string };
}

interface IdleBarProps {
  user: User | null;
  onStartSession: (task: string, roomId?: string | null) => void;
  onOpenRooms?: () => void;
  autoFocusInput?: boolean;
  onAutoFocusConsumed?: () => void;
  onOpenMentor?: () => void;
  onSessionStartIntent?: () => void;
}

function IdleBar({ user, onStartSession, onOpenRooms, autoFocusInput, onAutoFocusConsumed, onOpenMentor, onSessionStartIntent }: IdleBarProps) {
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [task, setTask] = useState('');

  // Bar drag state — JS pointer events, no webkit-app-region (that moves the whole window)
  const barRef = useRef<HTMLDivElement>(null);
  const [barPos, setBarPos] = useState<{ left: number; top: number } | null>(null);
  const dragState = useRef<{ startX: number; startY: number; initLeft: number; initTop: number } | null>(null);

  const handleHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      initLeft: rect.left + rect.width / 2, // center X (because translateX(-50%))
      initTop: rect.top,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const barW = barRef.current?.offsetWidth ?? 560;
    const barH = barRef.current?.offsetHeight ?? 52;
    const w = window.innerWidth;
    const h = window.innerHeight;
    setBarPos({
      left: Math.max(barW / 2, Math.min(w - barW / 2, dragState.current.initLeft + dx)),
      top: Math.max(0, Math.min(h - barH, dragState.current.initTop + dy)),
    });
  };

  const handleHandlePointerUp = () => {
    dragState.current = null;
  };

  // When dashboard sends "start focus session", auto-open the task input
  useEffect(() => {
    if (autoFocusInput) {
      setShowTaskInput(true);
      window.promethee.window.setFocusable(true);
      onAutoFocusConsumed?.();
    }
  }, [autoFocusInput]);

  const handleStartClick = () => {
    setShowTaskInput(true);
    window.promethee.window.setFocusable(true);
    onSessionStartIntent?.(); // Triggers Prestige Fade immediately
  };

  const dismissInput = () => {
    setShowTaskInput(false);
    setTask('');
    window.promethee.window.setFocusable(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && task.trim()) {
      // Don't call dismissInput() — the parent will unmount us when activeSession is set,
      // avoiding the blink of "collapsed bar" between input dismiss and active session render.
      onStartSession(task, null);
    } else if (e.key === 'Escape') {
      dismissInput();
    }
  };

  const handleMenuClick = () => window.promethee.window.toggleFullWindow();

  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const getInitial = () => {
    if (!user) return '?';
    return (user.user_metadata?.display_name || user.email || '').charAt(0).toUpperCase();
  };

  const barStyle = barPos
    ? { left: barPos.left, top: barPos.top, transform: 'translateX(-50%)' }
    : undefined;

  return (
    <div ref={barRef} className="idle-bar promethee-mouse-target" style={barStyle}>
      {/* Visible drag handle — JS pointer-event drag, NOT webkit-app-region (that moves the whole window) */}
      <div
        className="idle-bar__drag-handle"
        aria-hidden="true"
        onPointerDown={handleHandlePointerDown}
        onPointerMove={handleHandlePointerMove}
        onPointerUp={handleHandlePointerUp}
      >
        <svg width="6" height="14" viewBox="0 0 6 14" fill="none">
          <circle cx="1.5" cy="2"  r="1.2" fill="currentColor"/>
          <circle cx="4.5" cy="2"  r="1.2" fill="currentColor"/>
          <circle cx="1.5" cy="6"  r="1.2" fill="currentColor"/>
          <circle cx="4.5" cy="6"  r="1.2" fill="currentColor"/>
          <circle cx="1.5" cy="10" r="1.2" fill="currentColor"/>
          <circle cx="4.5" cy="10" r="1.2" fill="currentColor"/>
          <circle cx="1.5" cy="14" r="1.2" fill="currentColor"/>
          <circle cx="4.5" cy="14" r="1.2" fill="currentColor"/>
        </svg>
      </div>

      <button className="mentor-button" onClick={onOpenMentor}>
        Mentor
      </button>

      {showTaskInput ? (
        <input
          type="text"
          className="task-input"
          placeholder="What are you working on?"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (!task.trim()) dismissInput(); }}
          autoFocus
        />
      ) : (
        <button className="start-button" onClick={handleStartClick}>
          <span className="start-circle" />
          Start a session
        </button>
      )}

      <div className="user-controls">
        <PresencePill onClick={onOpenRooms} />
        <div className="user-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="user-avatar__img" />
            : getInitial()}
        </div>
        <button className="menu-button" onClick={handleMenuClick} title="Open dashboard">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
            <circle cx="2" cy="2" r="1.5" fill="currentColor"/>
            <circle cx="7" cy="2" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="2" r="1.5" fill="currentColor"/>
            <circle cx="2" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="7" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default IdleBar;
