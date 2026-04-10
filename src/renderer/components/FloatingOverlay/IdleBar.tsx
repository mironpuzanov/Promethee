import React, { useState, useEffect } from 'react';
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
      onStartSession(task, null);
      dismissInput();
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

  return (
    <div className="idle-bar promethee-mouse-target">
      {/* Visible drag handle — left edge, makes it obvious the bar is draggable */}
      <div className="idle-bar__drag-handle" aria-hidden="true">
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
