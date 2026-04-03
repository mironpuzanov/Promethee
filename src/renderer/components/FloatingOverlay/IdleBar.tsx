import React, { useState, useEffect } from 'react';
import PresencePill from './PresencePill';
import './IdleBar.css';

interface User {
  id: string;
  email: string;
}

interface IdleBarProps {
  user: User | null;
  onStartSession: (task: string, roomId?: string | null) => void;
  onOpenRooms?: () => void;
  autoFocusInput?: boolean;
  onAutoFocusConsumed?: () => void;
  onOpenMentor?: () => void;
}

function IdleBar({ user, onStartSession, onOpenRooms, autoFocusInput, onAutoFocusConsumed, onOpenMentor }: IdleBarProps) {
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

  const getInitial = () => {
    if (!user) return '?';
    return (user.email || '').charAt(0).toUpperCase();
  };

  const handleMouseEnter = () => window.promethee.window.setIgnoreMouseEvents(false);
  const handleMouseLeave = () => window.promethee.window.setIgnoreMouseEvents(true);

  return (
    <div className="idle-bar" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className="mentor-button"
        onClick={onOpenMentor}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.95)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.70)';
        }}
      >
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
        <div className="user-avatar">{getInitial()}</div>
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
