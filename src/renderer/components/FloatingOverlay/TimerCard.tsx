import React from 'react';
import './TimerCard.css';

interface TimerCardProps {
  elapsed: string;
  elapsedSeconds: number;
  task: string;
  xpSoFar: number;
  onStop: () => void;
  minimized: boolean;
  onToggleMinimize: () => void;
}

// Circle circumference = 2 * π * 32 ≈ 201
const CIRCUMFERENCE = 201;
// Progress resets every 10 minutes (600s) — gives satisfying visual ticks
const CYCLE = 600;

function TimerCard({ elapsed, elapsedSeconds, task, xpSoFar, onStop, minimized, onToggleMinimize }: TimerCardProps) {
  const progress = (elapsedSeconds % CYCLE) / CYCLE;
  const dashOffset = CIRCUMFERENCE - progress * CIRCUMFERENCE;

  const handleMouseEnter = () => window.promethee.window.setIgnoreMouseEvents(false);
  const handleMouseLeave = () => window.promethee.window.setIgnoreMouseEvents(true);

  if (minimized) {
    return (
      <div
        className="timer-card timer-card--minimized"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onToggleMinimize}
        style={{ cursor: 'pointer' }}
      >
        <div className="timer-ring">
          <svg width="48" height="48" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(232, 146, 42, 0.15)" strokeWidth="3" />
            <circle
              cx="36" cy="36" r="32"
              fill="none"
              stroke="var(--accent-fire)"
              strokeWidth="3"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className="timer-ring-label">{elapsed.slice(3)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="timer-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="timer-ring" onClick={onToggleMinimize} title="Minimize" style={{ cursor: 'pointer' }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(232, 146, 42, 0.15)" strokeWidth="3" />
          <circle
            cx="36" cy="36" r="32"
            fill="none"
            stroke="var(--accent-fire)"
            strokeWidth="3"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
      </div>
      <div className="timer-info">
        <div className="elapsed-time">{elapsed}</div>
        <div className="task-name">{task}</div>
        <div className="xp-so-far">+{xpSoFar} XP so far</div>
      </div>
      <button className="stop-button" onClick={onStop} title="End session">■</button>
    </div>
  );
}

export default TimerCard;
