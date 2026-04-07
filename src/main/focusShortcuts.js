import { app, globalShortcut } from 'electron';
import fs from 'fs';
import path from 'path';

export const FOCUS_SHORTCUT_DEFAULTS = {
  focusOpenMentor: 'CommandOrControl+Alt+M',
  focusAddTask: 'CommandOrControl+Alt+T',
  focusEndSession: 'CommandOrControl+Alt+E',
};

const KEYS = Object.keys(FOCUS_SHORTCUT_DEFAULTS);

let broadcastFn = () => {};

export function setFocusShortcutBroadcast(fn) {
  broadcastFn = typeof fn === 'function' ? fn : () => {};
}

function shortcutsPath() {
  return path.join(app.getPath('userData'), 'focus-shortcuts.json');
}

export function loadFocusShortcuts() {
  const out = { ...FOCUS_SHORTCUT_DEFAULTS };
  try {
    const p = shortcutsPath();
    if (fs.existsSync(p)) {
      const o = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const k of KEYS) {
        if (Object.prototype.hasOwnProperty.call(o, k) && typeof o[k] === 'string') {
          out[k] = o[k];
        }
      }
    }
  } catch (e) {
    console.warn('[Promethee] focus shortcuts load:', e.message);
  }
  return out;
}

/** Merge partial onto disk; empty string disables that binding. */
export function saveFocusShortcutsToDisk(partial) {
  const cur = loadFocusShortcuts();
  const next = { ...cur };
  for (const [k, v] of Object.entries(partial)) {
    if (!KEYS.includes(k)) continue;
    if (v === '' || v == null) next[k] = '';
    else next[k] = String(v).trim();
  }
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(shortcutsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** Return { ok, error? } — uses temporary register; leaves all unregistered (caller applies real). */
export function validateFocusShortcutsConfig(cfg) {
  const accs = KEYS.map((k) => (cfg[k] || '').trim()).filter(Boolean);
  if (new Set(accs).size !== accs.length) {
    return { ok: false, error: 'Each shortcut must be unique.' };
  }
  try {
    globalShortcut.unregisterAll();
    for (const a of accs) {
      const ok = globalShortcut.register(a, () => {});
      if (!ok) {
        globalShortcut.unregisterAll();
        return { ok: false, error: `Shortcut already in use or invalid: ${a}` };
      }
    }
  } finally {
    globalShortcut.unregisterAll();
  }
  return { ok: true };
}

export function applyRegisteredFocusShortcuts() {
  globalShortcut.unregisterAll();
  const cfg = loadFocusShortcuts();
  for (const [key, action] of [
    ['focusOpenMentor', 'openMentor'],
    ['focusAddTask', 'focusAddTask'],
    ['focusEndSession', 'endSession'],
  ]) {
    const acc = (cfg[key] || '').trim();
    if (!acc) continue;
    const ok = globalShortcut.register(acc, () => {
      try {
        broadcastFn(action);
      } catch (e) {
        console.warn('[Promethee] focus shortcut broadcast:', e);
      }
    });
    if (!ok) console.warn(`[Promethee] globalShortcut register failed: ${acc}`);
  }
}

export function unregisterAllFocusShortcuts() {
  try {
    globalShortcut.unregisterAll();
  } catch {
    /* ignore */
  }
}
