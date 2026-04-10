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
    justify-content: center;
    width: 100%;
    padding: 9px 16px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.55);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    user-select: none;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
    font-family: inherit;
  }

  .sfb-spark {
    width: 14px;
    height: 14px;
    fill: currentColor;
    margin-right: 7px;
    flex-shrink: 0;
    opacity: 0.7;
    animation: sfb-flicker 3s ease-in-out infinite;
  }

  @keyframes sfb-flicker {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 0.9; }
  }

  .sfb-letter {
    display: inline-block;
    animation: sfb-wave 3s ease-in-out infinite;
  }

  @keyframes sfb-wave {
    0%, 100% { opacity: 0.55; }
    50%       { opacity: 0.85; }
  }

  .sfb-letter:nth-child(1)  { animation-delay: 0s; }
  .sfb-letter:nth-child(2)  { animation-delay: 0.05s; }
  .sfb-letter:nth-child(3)  { animation-delay: 0.10s; }
  .sfb-letter:nth-child(4)  { animation-delay: 0.15s; }
  .sfb-letter:nth-child(5)  { animation-delay: 0.20s; }
  .sfb-letter:nth-child(6)  { animation-delay: 0.25s; }
  .sfb-letter:nth-child(7)  { animation-delay: 0.30s; }
  .sfb-letter:nth-child(8)  { animation-delay: 0.35s; }
  .sfb-letter:nth-child(9)  { animation-delay: 0.40s; }
  .sfb-letter:nth-child(10) { animation-delay: 0.45s; }
  .sfb-letter:nth-child(11) { animation-delay: 0.50s; }
  .sfb-letter:nth-child(12) { animation-delay: 0.55s; }
  .sfb-letter:nth-child(13) { animation-delay: 0.60s; }
  .sfb-letter:nth-child(14) { animation-delay: 0.65s; }
  .sfb-letter:nth-child(15) { animation-delay: 0.70s; }
  .sfb-letter:nth-child(16) { animation-delay: 0.75s; }
  .sfb-letter:nth-child(17) { animation-delay: 0.80s; }
  .sfb-letter:nth-child(18) { animation-delay: 0.85s; }

  /* Hover — simple fire accent, no glow mess */
  .sfb-btn:hover {
    background: rgba(232, 146, 42, 0.08);
    border-color: rgba(232, 146, 42, 0.35);
    color: rgba(255,255,255,0.9);
  }
  .sfb-btn:hover .sfb-spark {
    opacity: 1;
    animation: none;
  }
  .sfb-btn:hover .sfb-letter {
    opacity: 1;
    animation: none;
  }

  /* Active */
  .sfb-btn:active {
    background: rgba(232, 146, 42, 0.14);
    border-color: rgba(232, 146, 42, 0.55);
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
      <svg className="sfb-spark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
      </svg>
      <span aria-label={label}>
        {Array.from(label).map((ch, i) => (
          <span key={i} className="sfb-letter" aria-hidden="true">
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        ))}
      </span>
    </button>
  );
}
