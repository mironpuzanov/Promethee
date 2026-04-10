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
    background: #E8922A;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    user-select: none;
    transition: background 0.18s, opacity 0.18s;
    font-family: inherit;
  }

  .sfb-btn:hover {
    background: #d4801e;
  }

  .sfb-btn:active {
    background: #c07018;
    transform: scale(0.98);
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
