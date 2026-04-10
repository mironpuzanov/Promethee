import * as React from 'react';

interface StartFocusButtonProps {
  onClick?: () => void;
  label?: string;
  className?: string;
}

const STYLES = `
  .sfb-btn {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--accent-fire, #e8922a);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s, color 0.15s;
    font-family: inherit;
    text-align: left;
    gap: 12px;
  }

  .sfb-btn:hover {
    background: rgba(232, 146, 42, 0.08);
    color: var(--accent-fire, #e8922a);
  }

  .sfb-btn:active {
    background: rgba(232, 146, 42, 0.12);
    transform: scale(0.98);
  }

  .sfb-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0.9;
  }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
}

export default function StartFocusButton({ onClick, label = 'Start focus session', className }: StartFocusButtonProps) {
  React.useEffect(() => { injectStyles(); }, []);

  return (
    <button
      type="button"
      className={`sfb-btn${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {/* Play icon — matches nav item icon sizing */}
      <span className="sfb-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.5 2.5L12 7.5L3.5 12.5V2.5Z" fill="currentColor" />
        </svg>
      </span>
      <span>{label}</span>
    </button>
  );
}
