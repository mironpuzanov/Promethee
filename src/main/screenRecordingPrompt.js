/**
 * macOS: active-win needs Screen Recording (window titles). No programmatic grant —
 * we prime desktopCapturer, then offer a native dialog + deep link to Settings.
 *
 * Do NOT trust systemPreferences.getMediaAccessStatus('screen') alone: Electron often
 * reports "granted" for desktopCapturer while active-win's native call still fails, so
 * we probe active-win before skipping the prompt.
 */

import { app, desktopCapturer, dialog, shell, BrowserWindow } from 'electron';
import { probeForegroundApp } from './windowTracker.js';
import fs from 'fs';
import path from 'path';

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function statePath() {
  return path.join(app.getPath('userData'), 'permission-prompts.json');
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(statePath(), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** One prompt per app run (unless snoozed before launch). */
let promptAttemptedThisRun = false;

/** Call when re-checking (e.g. session start) so we can show the dialog if active-win still fails. */
export function resetScreenRecordingPromptGate() {
  promptAttemptedThisRun = false;
}

/**
 * @param {import('electron').BrowserWindow | null | undefined} parentWindow
 */
export async function maybePromptScreenRecordingAccess(parentWindow) {
  if (process.platform !== 'darwin') return;
  if (!app.isReady()) return;

  if (promptAttemptedThisRun) return;
  promptAttemptedThisRun = true;
  console.log('[Promethee] Running active-win probe + Screen Recording dialog gate…');

  try {
    await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
    });
  } catch {
    /* still may need Settings toggle */
  }

  const probe = await probeForegroundApp();
  if (probe.ok) {
    console.info('[Promethee] Foreground app sampling is working (active-win). No permission dialog needed.');
    return;
  }

  const state = loadState();
  if (state.screenRecordingSnoozedUntil && Date.now() < state.screenRecordingSnoozedUntil) {
    const until = new Date(state.screenRecordingSnoozedUntil).toISOString();
    console.warn(
      `[Promethee] active-win still failing (${probe.error || 'no foreground data'}). ` +
        `System permission dialog is snoozed until ${until}. Delete this file to show the dialog again:\n  ${statePath()}`
    );
    return;
  }

  const tech = !app.isPackaged
    ? `\n\nTechnical (dev):\nThis process: ${process.execPath}\n${probe.error ? `Details: ${probe.error}` : ''}\n\nIf Screen Recording is already ON for “Electron”, add the **same** Electron.app shown above (or enable **Accessibility** for Electron too) then fully quit (⌘Q) and run npm start again.`
    : `\n\n${probe.error ? `Details: ${probe.error}` : ''}`;

  const parent =
    parentWindow && !parentWindow.isDestroyed()
      ? parentWindow
      : BrowserWindow.getFocusedWindow() || undefined;

  const devBundleHint =
    !app.isPackaged &&
    `\n\n— Development (npm start) —\nmacOS shows this as **Electron**, not Promethee. Turn on the **Electron** toggle.\n\nIf Electron is not listed: click **+** in Screen Recording, press ⌘⇧G (Go to folder), paste this path, select **Electron.app**:\n${path.resolve(path.dirname(process.execPath), '..', '..')}`;

  const { response } = await dialog.showMessageBox(parent ?? undefined, {
    type: 'info',
    title: 'Screen recording',
    message: 'Allow app usage tracking?',
    detail:
      'Promethee uses Screen Recording on macOS to read which app is in front (window titles only — not a video of your screen).\n\n' +
      (app.isPackaged
        ? 'Turn on **Promethee** under Privacy & Security → Screen Recording. If problems remain, also allow **Accessibility** for Promethee, then fully quit and reopen.'
        +
        tech
        : 'Turn on **Electron** under Privacy & Security → Screen Recording (and **Accessibility** if macOS still blocks window info). Fully quit the app (⌘Q) after changing permissions.' +
      (devBundleHint || '') +
        tech),
    buttons: ['Open System Settings', 'Remind me later'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    );
  } else {
    state.screenRecordingSnoozedUntil = Date.now() + SNOOZE_MS;
    saveState(state);
  }
}
