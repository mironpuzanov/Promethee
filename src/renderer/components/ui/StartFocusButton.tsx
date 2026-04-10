import * as React from 'react';

interface StartFocusButtonProps {
  onClick?: () => void;
  label?: string;
  className?: string;
}

const STYLES = `
  .sfb-btn {
    --sfb-hue: 30deg;
    --sfb-highlight: hsla(var(--sfb-hue), 90%, 62%, 1);
    --sfb-highlight-50: hsla(var(--sfb-hue), 90%, 62%, 0.5);
    --sfb-highlight-30: hsla(var(--sfb-hue), 90%, 62%, 0.3);
    --sfb-highlight-20: hsla(var(--sfb-hue), 90%, 62%, 0.2);
    --sfb-highlight-80: hsla(var(--sfb-hue), 90%, 62%, 0.8);
    --sfb-radius: 10px;
    --sfb-pad: 4px;
    --sfb-t: 0.35s;

    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 9px 16px;
    border-radius: var(--sfb-radius);
    background: #0e0c0a;
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.6);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    user-select: none;
    transition: border-color var(--sfb-t), color var(--sfb-t), background var(--sfb-t);
    box-shadow:
      inset 0 1px 1px rgba(255,255,255,0.08),
      inset 0 4px 8px rgba(255,255,255,0.04);
    font-family: inherit;
  }

  .sfb-btn::before {
    content: '';
    position: absolute;
    inset: calc(0px - var(--sfb-pad));
    border-radius: calc(var(--sfb-radius) + var(--sfb-pad));
    pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.5));
    z-index: -1;
    transition: box-shadow var(--sfb-t);
    box-shadow:
      0 -8px 8px -6px transparent inset,
      1px 1px 1px rgba(255,255,255,0.08),
      -1px -1px 1px rgba(0,0,0,0.15);
  }

  .sfb-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,0.9), var(--sfb-highlight), var(--sfb-highlight-50) 8%, transparent);
    opacity: 0;
    transition: opacity var(--sfb-t);
  }

  /* SVG spark */
  .sfb-spark {
    width: 15px;
    height: 15px;
    fill: rgba(255,255,255,0.45);
    margin-right: 7px;
    flex-shrink: 0;
    transition: fill var(--sfb-t), filter var(--sfb-t);
    animation: sfb-flicker 2.4s linear infinite;
    animation-delay: 0.4s;
  }

  @keyframes sfb-flicker {
    50% { opacity: 0.35; }
  }

  /* Label letters */
  .sfb-letter {
    display: inline-block;
    color: rgba(255,255,255,0.55);
    animation: sfb-letter-pulse 2.8s ease-in-out infinite;
    transition: color var(--sfb-t), text-shadow var(--sfb-t);
  }

  @keyframes sfb-letter-pulse {
    50% {
      color: rgba(255,255,255,0.9);
      text-shadow: 0 0 4px rgba(255,255,255,0.4);
    }
  }

  /* Stagger the letters */
  .sfb-letter:nth-child(1)  { animation-delay: 0s; }
  .sfb-letter:nth-child(2)  { animation-delay: 0.06s; }
  .sfb-letter:nth-child(3)  { animation-delay: 0.12s; }
  .sfb-letter:nth-child(4)  { animation-delay: 0.18s; }
  .sfb-letter:nth-child(5)  { animation-delay: 0.24s; }
  .sfb-letter:nth-child(6)  { animation-delay: 0.30s; }
  .sfb-letter:nth-child(7)  { animation-delay: 0.36s; }
  .sfb-letter:nth-child(8)  { animation-delay: 0.42s; }
  .sfb-letter:nth-child(9)  { animation-delay: 0.48s; }
  .sfb-letter:nth-child(10) { animation-delay: 0.54s; }
  .sfb-letter:nth-child(11) { animation-delay: 0.60s; }
  .sfb-letter:nth-child(12) { animation-delay: 0.66s; }
  .sfb-letter:nth-child(13) { animation-delay: 0.72s; }
  .sfb-letter:nth-child(14) { animation-delay: 0.78s; }
  .sfb-letter:nth-child(15) { animation-delay: 0.84s; }
  .sfb-letter:nth-child(16) { animation-delay: 0.90s; }
  .sfb-letter:nth-child(17) { animation-delay: 0.96s; }
  .sfb-letter:nth-child(18) { animation-delay: 1.02s; }

  /* Hover */
  .sfb-btn:hover {
    border-color: hsla(var(--sfb-hue), 90%, 70%, 0.4);
    color: rgba(255,255,255,0.9);
  }
  .sfb-btn:hover::before {
    box-shadow:
      0 -8px 10px -6px rgba(255,255,255,0.6) inset,
      0 -16px 16px -10px var(--sfb-highlight-30) inset,
      1px 1px 1px rgba(255,255,255,0.12),
      -1px -1px 1px rgba(0,0,0,0.12);
  }
  .sfb-btn:hover::after {
    opacity: 0.9;
    -webkit-mask-image: linear-gradient(180deg, #fff, transparent);
    mask-image: linear-gradient(180deg, #fff, transparent);
  }
  .sfb-btn:hover .sfb-spark {
    fill: rgba(255,255,255,0.9);
    filter: drop-shadow(0 0 4px var(--sfb-highlight)) drop-shadow(0 -3px 5px rgba(0,0,0,0.6));
    animation: none;
  }
  .sfb-btn:hover .sfb-letter {
    color: rgba(255,255,255,0.95);
    animation: none;
  }

  /* Active / pressed */
  .sfb-btn:active {
    border-color: hsla(var(--sfb-hue), 90%, 70%, 0.65);
    background: hsla(var(--sfb-hue), 50%, 12%, 0.6);
  }
  .sfb-btn:active::before {
    box-shadow:
      0 -10px 14px -6px rgba(255,255,255,0.75) inset,
      0 -18px 18px -10px var(--sfb-highlight-80) inset,
      1px 1px 1px rgba(255,255,255,0.15),
      -1px -1px 1px rgba(0,0,0,0.1);
  }
  .sfb-btn:active::after {
    opacity: 1;
    -webkit-mask-image: linear-gradient(180deg, #fff, transparent);
    mask-image: linear-gradient(180deg, #fff, transparent);
    filter: brightness(180%);
  }
  .sfb-btn:active .sfb-letter {
    text-shadow: 0 0 2px hsla(var(--sfb-hue), 100%, 85%, 0.8);
    animation: none;
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
      {/* Spark icon (sparkles path from heroicons) */}
      <svg className="sfb-spark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
      </svg>

      {/* Letter-by-letter animated label */}
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
