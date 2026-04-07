import React, { useCallback, useEffect, useRef, useState } from 'react';

function inputBaseClass() {
  return 'w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors';
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || '');

function keyEventToAccelerator(e: React.KeyboardEvent): string | null {
  if (e.repeat) return null;
  if (e.key === 'Escape') return null;

  const keyIgn = ['Control', 'Shift', 'Alt', 'Meta'];
  if (keyIgn.includes(e.key)) return null;

  let keyPart: string | null = null;
  if (e.key.length === 1) keyPart = e.key.toUpperCase();
  else {
    const map: Record<string, string> = {
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Enter: 'Return',
      ' ': 'Space',
      Backspace: 'Backspace',
      Delete: 'Delete',
      Tab: 'Tab',
      Escape: 'Escape',
    };
    if (e.key.startsWith('F') && /^F\d{1,2}$/.test(e.key)) keyPart = e.key;
    else keyPart = map[e.key] ?? null;
  }
  if (!keyPart) return null;

  const mods: string[] = [];
  if (isMac && e.metaKey) mods.push('CommandOrControl');
  else if (!isMac && e.ctrlKey) mods.push('CommandOrControl');
  else if (!isMac && e.metaKey) mods.push('Super');
  else if (isMac && e.ctrlKey) mods.push('Control');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  if (mods.length === 0) return null;

  e.preventDefault();
  e.stopPropagation();
  return `${mods.join('+')}+${keyPart}`;
}

interface ShortcutFieldProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

/** Text field + optional capture. Uses Electron accelerator syntax (e.g. `CommandOrControl+Alt+M`). */
export function ShortcutField({ id, value, onChange, disabled }: ShortcutFieldProps) {
  const [recording, setRecording] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recording) return;
    const onDoc = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setRecording(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [recording]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setRecording(false);
        return;
      }
      const acc = keyEventToAccelerator(e);
      if (acc) {
        onChange(acc);
        setRecording(false);
      }
    },
    [recording, onChange]
  );

  return (
    <div ref={wrapRef} className="flex flex-col gap-1.5">
      <div className="flex gap-2 items-center">
        <input
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(ev) => onChange(ev.target.value)}
          onKeyDown={onKeyDown}
          placeholder="e.g. CommandOrControl+Alt+M"
          className={inputBaseClass()}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setRecording((r) => !r)}
          className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            recording
              ? 'border-destructive text-destructive bg-destructive/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-ring'
          } disabled:opacity-50`}
        >
          {recording ? 'Cancel' : 'Record'}
        </button>
      </div>
      {recording && (
        <p className="text-[11px] text-muted-foreground">Press the key combination. Esc cancels recording only.</p>
      )}
    </div>
  );
}
