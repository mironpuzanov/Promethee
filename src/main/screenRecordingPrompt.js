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

// Returns true if the in-app permissions onboarding has been completed.
// While it hasn't, the native dialog is suppressed — the in-app flow handles it.
function isOnboardingSeen() {
  try {
    return fs.existsSync(path.join(app.getPath('userData'), 'permissions-onboarding-seen.json'));
  } catch {
    return false;
  }
}

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

/** Returns true if the user has an active snooze (dialog suppressed until future date). */
export function isScreenRecordingSnoozed() {
  const state = loadState();
  return Boolean(state.screenRecordingSnoozedUntil && Date.now() < state.screenRecordingSnoozedUntil);
}

/** Returns true if the user already went to System Settings to grant permission. */
export function isScreenRecordingAcknowledged() {
  return Boolean(loadState().screenRecordingAcknowledged);
}

/** Returns true if the user explicitly rejected the permission dialog ("Don't ask again"). */
export function isScreenRecordingRejected() {
  return Boolean(loadState().screenRecordingRejected);
}

/**
 * Call when re-checking (e.g. session start) so we can show the dialog if active-win still fails.
 * No-op if the user snoozed, acknowledged, or rejected — avoids re-prompting.
 */
export function resetScreenRecordingPromptGate() {
  if (isScreenRecordingSnoozed()) return;
  if (isScreenRecordingAcknowledged()) return;
  if (isScreenRecordingRejected()) return;
  promptAttemptedThisRun = false;
}

/**
 * @param {import('electron').BrowserWindow | null | undefined} parentWindow
 */
export async function maybePromptScreenRecordingAccess(parentWindow) {
  if (process.platform !== 'darwin') return;
  if (!app.isReady()) return;

  // Suppress native dialog while in-app onboarding hasn't been completed yet.
  // The onboarding screen handles permissions sequentially — we don't want both.
  if (!isOnboardingSeen()) return;

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

  let probe = await probeForegroundApp();
  if (!probe.ok) {
    // TCC sometimes needs a moment to propagate after first grant — retry once after 2s
    await new Promise((r) => setTimeout(r, 2000));
    probe = await probeForegroundApp();
  }
  if (probe.ok) {
    console.info('[Promethee] Foreground app sampling is working (active-win). No permission dialog needed.');
    return;
  }

  const state = loadState();

  // User previously went to Settings to grant permission.
  // active-win often returns null on the first call after granting because macOS requires
  // a full app restart for TCC to take effect. Show a "please restart" nudge instead of
  // re-showing the full permission dialog.
  if (state.screenRecordingAcknowledged) {
    console.info('[Promethee] Screen Recording was acknowledged — active-win still failing, likely needs restart.');
    const parent =
      parentWindow && !parentWindow.isDestroyed()
        ? parentWindow
        : BrowserWindow.getFocusedWindow() || undefined;
    const { response } = await dialog.showMessageBox(parent ?? undefined, {
      type: 'info',
      title: 'Restart required',
      message: 'Fully quit Promethee to apply Screen Recording',
      detail:
        'macOS needs a full restart of Promethee to activate Screen Recording.\n\nQuit the app completely (⌘Q), then reopen it.',
      buttons: ['Got it — I\'ll restart', 'I didn\'t grant it', 'Don\'t ask again'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 1) {
      // User says they didn't actually grant — clear the flag so we show the main dialog next time
      delete state.screenRecordingAcknowledged;
      saveState(state);
    } else if (response === 2) {
      // User wants to stop being asked entirely
      delete state.screenRecordingAcknowledged;
      state.screenRecordingRejected = true;
      saveState(state);
    }
    // Either way, don't show the main permission dialog this run
    return;
  }

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
        + tech
        : 'Turn on **Electron** under Privacy & Security → Screen Recording (and **Accessibility** if macOS still blocks window info). Fully quit the app (⌘Q) after changing permissions.' +
      (devBundleHint || '') + tech),
    buttons: ['Open System Settings', 'Remind me later', 'Don\'t ask again'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    // User is going to Settings — mark acknowledged so we don't re-show the main dialog.
    // We'll show a "restart required" nudge on the next launch if active-win still fails.
    state.screenRecordingAcknowledged = true;
    saveState(state);
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    );
  } else if (response === 2) {
    // User explicitly rejected — never ask again
    state.screenRecordingRejected = true;
    saveState(state);
  } else {
    // Remind me later — snooze for 7 days
    state.screenRecordingSnoozedUntil = Date.now() + SNOOZE_MS;
    saveState(state);
  }
}
