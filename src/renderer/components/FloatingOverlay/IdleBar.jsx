import React, { useState } from 'react';
import './IdleBar.css';

function IdleBar({ user, onStartSession }) {
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [task, setTask] = useState('');

  const handleStartClick = () => {
    setShowTaskInput(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && task.trim()) {
      onStartSession(task);
      setTask('');
      setShowTaskInput(false);
    } else if (e.key === 'Escape') {
      setShowTaskInput(false);
      setTask('');
    }
  };

  const handleMentorClick = () => {
    alert('Mentor feature coming soon!');
  };

  const handleMenuClick = () => {
    window.promethee.window.toggleFullWindow();
  };

  const getInitial = () => {
    if (!user) return '?';
    const email = user.email || '';
    return email.charAt(0).toUpperCase();
  };

  return (
    <div className="idle-bar">
      <button className="mentor-button" onClick={handleMentorClick}>
        🔥 Mentor
      </button>

      {showTaskInput ? (
        <input
          type="text"
          className="task-input"
          placeholder="What are you working on?"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!task.trim()) {
              setShowTaskInput(false);
            }
          }}
          autoFocus
        />
      ) : (
        <button className="start-button" onClick={handleStartClick}>
          ○ Start a session
        </button>
      )}

      <div className="user-controls">
        <div className="user-avatar">{getInitial()}</div>
        <button className="menu-button" onClick={handleMenuClick}>
          ⋮⋮
        </button>
      </div>
    </div>
  );
}

export default IdleBar;
