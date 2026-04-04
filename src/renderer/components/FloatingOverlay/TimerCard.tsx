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

const CIRCUMFERENCE = 201;
const CYCLE = 600;

function TimerCard({ elapsed, elapsedSeconds, task, xpSoFar, onStop, minimized, onToggleMinimize }: TimerCardProps) {
  const progress = (elapsedSeconds % CYCLE) / CYCLE;
  const dashOffset = CIRCUMFERENCE - progress * CIRCUMFERENCE;

  const handleMouseEnter = () => window.promethee.window.setIgnoreMouseEvents(false);
  const handleMouseLeave = () => window.promethee.window.setIgnoreMouseEvents(true);

  if (minimized) {
    return (
      <div
        className="timer-card timer-card--pill"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onToggleMinimize}
      >
        <div className="timer-pill-ring">
          <svg width="20" height="20" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(232,146,42,0.2)" strokeWidth="6" />
            <circle
              cx="36" cy="36" r="32"
              fill="none"
              stroke="var(--accent-fire)"
              strokeWidth="6"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
        </div>
        <span className="timer-pill-time">{elapsed}</span>
        <button className="stop-button" onClick={e => { e.stopPropagation(); onStop(); }} title="End session">■</button>
      </div>
    );
  }

  return (
    <div
      className="timer-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="timer-ring">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="32" fill="none" stroke="var(--accent-glow)" strokeWidth="3" />
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
      <div className="timer-actions">
        <button className="timer-minimize" onClick={onToggleMinimize} title="Collapse">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
        <button className="stop-button" onClick={onStop} title="End session">■</button>
      </div>
    </div>
  );
}

export default TimerCard;
