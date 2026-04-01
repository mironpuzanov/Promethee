import React from 'react';
import './TimerCard.css';

function TimerCard({ elapsed, task, xpSoFar, onStop }) {
  return (
    <div className="timer-card">
      <div className="timer-ring">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke="rgba(6, 182, 212, 0.2)"
            strokeWidth="3"
          />
          <circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth="3"
            strokeDasharray="201"
            strokeDashoffset="50"
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
          />
        </svg>
      </div>
      <div className="timer-info">
        <div className="elapsed-time">{elapsed}</div>
        <div className="task-name">{task}</div>
        <div className="xp-so-far">+{xpSoFar} XP so far</div>
      </div>
      <button className="stop-button" onClick={onStop}>
        ■
      </button>
    </div>
  );
}

export default TimerCard;
