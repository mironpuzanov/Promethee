import React, { useState } from 'react';
import './IdleBar.css';

interface User {
  id: string;
  email: string;
}

interface IdleBarProps {
  user: User | null;
  onStartSession: (task: string) => void;
}

function IdleBar({ user, onStartSession }: IdleBarProps) {
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [task, setTask] = useState('');

  const handleStartClick = () => setShowTaskInput(true);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && task.trim()) {
      onStartSession(task);
      setTask('');
      setShowTaskInput(false);
    } else if (e.key === 'Escape') {
      setShowTaskInput(false);
      setTask('');
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
      <button className="mentor-button" onClick={() => alert('Mentor coming soon!')}>
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
          onBlur={() => { if (!task.trim()) setShowTaskInput(false); }}
          autoFocus
        />
      ) : (
        <button className="start-button" onClick={handleStartClick}>
          <span className="start-circle" />
          Start a session
        </button>
      )}

      <div className="user-controls">
        <div className="user-avatar">{getInitial()}</div>
        <button className="menu-button" onClick={handleMenuClick} title="Open dashboard">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="2.5" cy="2.5" r="1.5" fill="currentColor"/>
            <circle cx="7" cy="2.5" r="1.5" fill="currentColor"/>
            <circle cx="11.5" cy="2.5" r="1.5" fill="currentColor"/>
            <circle cx="2.5" cy="7" r="1.5" fill="currentColor"/>
            <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
            <circle cx="11.5" cy="7" r="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default IdleBar;
