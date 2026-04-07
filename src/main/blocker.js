/**
 * blocker.js — Website blocker module for Promethee.
 *
 * Architecture:
 *   Electron app  ──Unix socket──►  PrometheeBlockerHelper (root daemon)
 *                                     writes /etc/hosts, flushes DNS
 *
 * Installation (user-facing, no terminal):
 *   - In packaged builds: SMJobBless via a bundled Swift installer tool
 *     (triggers the native macOS "Promethee wants to make changes" dialog)
 *   - In dev: osascript with administrator privileges
 *     (triggers same native macOS password dialog)
 *
 * All public functions return { ok, error? } and never throw.
 * Blocker failure NEVER blocks session start or end.
 */

import net from 'net';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Constants ─────────────────────────────────────────────────────────────────

const SOCKET_PATH   = '/var/run/promethee-blocker.sock';
const HELPER_ID     = 'app.promethee.blocker-helper';
const HELPER_DST    = `/Library/PrivilegedHelperTools/${HELPER_ID}`;
const LAUNCHD_DST   = `/Library/LaunchDaemons/${HELPER_ID}.plist`;
const BEGIN_MARKER  = '# BEGIN PROMETHEE BLOCKER';
const END_MARKER    = '# END PROMETHEE BLOCKER';
const HOSTS_PATH    = '/etc/hosts';
const TIMEOUT_MS    = 3000;

// ── IPC broadcast ─────────────────────────────────────────────────────────────

/**
 * @param {'active'|'unavailable'|'not-installed'|'inactive'} state
 * @param {object} [extra]
 */
function broadcastStatus(state, extra = {}) {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('blocker:status', { state, ...extra });
    });
  } catch { /* never throw */ }
}

// ── Unix socket communication ─────────────────────────────────────────────────

function sendCommand(payload) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SOCKET_PATH)) return reject(Object.assign(new Error('not-installed'), { code: 'ENOENT' }));

    const client = net.createConnection(SOCKET_PATH, () => client.write(JSON.stringify(payload)));
    let raw = '';
    const timer = setTimeout(() => { client.destroy(); reject(new Error('timeout')); }, TIMEOUT_MS);

    client.on('data', (chunk) => {
      raw += chunk.toString();
      try { const p = JSON.parse(raw); clearTimeout(timer); client.destroy(); resolve(p); } catch { /* keep reading */ }
    });
    client.on('error', (err) => { clearTimeout(timer); reject(err); });
    client.on('close', () => {
      clearTimeout(timer);
      if (!raw) return;
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid response')); }
    });
  });
}

// ── Session blocker API ───────────────────────────────────────────────────────

export async function activate(_sessionId, domains) {
  if (!domains || domains.length === 0) { broadcastStatus('inactive'); return { ok: true }; }
  try {
    const result = await sendCommand({ cmd: 'activate', domains });
    if (result.ok) { broadcastStatus('active'); return { ok: true }; }
    console.warn('[blocker] activate failed:', result.error);
    broadcastStatus('unavailable');
    return { ok: false, error: result.error };
  } catch (err) {
    return _handleSendError(err);
  }
}

export async function deactivate() {
  try {
    const result = await sendCommand({ cmd: 'deactivate' });
    broadcastStatus('inactive');
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    broadcastStatus('inactive'); // always go inactive on session end
    return _handleSendError(err, /* silent */ true);
  }
}

function _handleSendError(err, silent = false) {
  const notInstalled = err.message === 'not-installed' || err.code === 'ENOENT' || err.code === 'ECONNREFUSED';
  if (notInstalled) {
    if (!silent) broadcastStatus('not-installed');
    return { ok: false, error: 'Blocker helper not installed' };
  }
  if (err.message === 'timeout') {
    if (!silent) broadcastStatus('unavailable');
    return { ok: false, error: 'Blocker helper timed out' };
  }
  if (!silent) { console.warn('[blocker] socket error:', err.message); broadcastStatus('unavailable'); }
  return { ok: false, error: err.message };
}

// ── Startup crash recovery ────────────────────────────────────────────────────

export async function cleanupOnStartup(getActiveSessionFn) {
  try {
    let hostsContent = '';
    try { hostsContent = fs.readFileSync(HOSTS_PATH, 'utf8'); } catch { return; }
    if (!hostsContent.includes(BEGIN_MARKER)) return;

    let active = null;
    try { active = getActiveSessionFn(); } catch { /* ignore */ }
    if (active) { broadcastStatus('active'); return; }

    console.log('[blocker] startup: stale hosts block found, cleaning up...');
    const result = await deactivate();
    if (!result.ok) {
      // Helper not running yet — strip directly as a fallback
      try { fs.writeFileSync(HOSTS_PATH, _stripBlock(hostsContent)); } catch (e) {
        console.warn('[blocker] direct cleanup fallback failed:', e.message);
      }
    }
  } catch (err) {
    console.warn('[blocker] cleanupOnStartup error:', err.message);
  }
}

function _stripBlock(content) {
  const lines = content.split('\n');
  const out = [];
  let inBlock = false;
  for (const l of lines) {
    if (l.startsWith(BEGIN_MARKER)) { inBlock = true; continue; }
    if (l.startsWith(END_MARKER))   { inBlock = false; continue; }
    if (!inBlock) out.push(l);
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}

// ── Installation ──────────────────────────────────────────────────────────────

/**
 * Check if the helper is installed and reachable.
 * Returns { installed, running }
 */
export async function checkInstallation() {
  const installed = fs.existsSync(HELPER_DST) && fs.existsSync(LAUNCHD_DST);
  if (!installed) return { installed: false, running: false };

  // Ping the socket
  try {
    const r = await Promise.race([
      sendCommand({ cmd: 'deactivate' }), // safe no-op if not active
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
    ]);
    return { installed: true, running: !!r };
  } catch {
    return { installed: true, running: false };
  }
}

/**
 * Install the privileged helper.
 *
 * In packaged builds: calls the embedded SMJobBless installer (native dialog).
 * In dev builds: uses osascript with administrator privileges (same native dialog).
 *
 * Returns { ok, error? }
 */
export async function installHelper() {
  try {
    const isPacked = app.isPackaged;

    if (isPacked) {
      return await _installViaSMJobBless();
    } else {
      return await _installViaOsascript();
    }
  } catch (err) {
    console.error('[blocker] installHelper error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Uninstall the privileged helper (requires admin auth).
 * Returns { ok, error? }
 */
export async function uninstallHelper() {
  const script = [
    `launchctl unload "${LAUNCHD_DST}" 2>/dev/null || true`,
    `rm -f "${LAUNCHD_DST}"`,
    `rm -f "${HELPER_DST}"`,
    `rm -f "${SOCKET_PATH}"`,
  ].join(' && ');

  return _runWithAdmin(script, 'Promethee wants to remove the website blocker helper.');
}

// ── Install strategies ────────────────────────────────────────────────────────

/**
 * SMJobBless path — used in packaged, signed builds.
 * The helper binary lives inside the app bundle at:
 *   Contents/Library/LaunchServices/app.promethee.blocker-helper
 * SMJobBless moves it to /Library/PrivilegedHelperTools/ after auth.
 */
async function _installViaSMJobBless() {
  // The SMJobBless call must happen from a native process because Node can't
  // import ServiceManagement.framework directly. We use a bundled tiny Swift
  // installer tool (PrometheeHelperInstaller) for this. If it's missing, fall back.
  const installerPath = path.join(process.resourcesPath || '', '..', 'MacOS', 'PrometheeHelperInstaller');

  if (fs.existsSync(installerPath)) {
    return new Promise((resolve) => {
      execFile(installerPath, [], { timeout: 30000 }, (err, stdout) => {
        if (err) { resolve({ ok: false, error: err.message }); return; }
        try { resolve(JSON.parse(stdout.trim())); } catch { resolve({ ok: true }); }
      });
    });
  }

  // Fallback: osascript (works for both dev and packaged without the installer tool)
  return _installViaOsascript();
}

/**
 * osascript path — works in dev and as a packaged fallback.
 * Triggers the native macOS "Promethee wants to make changes" password dialog.
 */
async function _installViaOsascript() {
  // Find the helper binary — in dev it's in the source tree; in packaged it's in the bundle.
  const helperSrc = _findHelperBinary();
  if (!helperSrc) {
    return { ok: false, error: 'Helper binary not found. Run: bash native/macos/PrometheeBlockerHelper/build.sh' };
  }

  const plistSrc = _findHelperPlist();

  const installScript = _buildInstallScript(helperSrc, plistSrc);
  return _runWithAdmin(installScript, 'Promethee wants to install the website blocker helper.');
}

function _findHelperBinary() {
  // Packaged: inside app bundle
  const bundledPath = path.join(
    process.resourcesPath || '',
    '..', 'Library', 'LaunchServices', HELPER_ID
  );
  if (fs.existsSync(bundledPath)) return bundledPath;

  // Dev: source tree (relative to the compiled main process location)
  // __dirname in dev = .vite/build/ — go up to project root
  const devPath = path.resolve(__dirname, '../../native/macos/PrometheeBlockerHelper', HELPER_ID);
  if (fs.existsSync(devPath)) return devPath;

  // Also check relative to CWD
  const cwdPath = path.resolve(process.cwd(), 'native/macos/PrometheeBlockerHelper', HELPER_ID);
  if (fs.existsSync(cwdPath)) return cwdPath;

  return null;
}

function _findHelperPlist() {
  const name = `${HELPER_ID}.plist`;

  const bundledPath = path.join(process.resourcesPath || '', '..', 'Library', 'LaunchServices', name);
  if (fs.existsSync(bundledPath)) return bundledPath;

  const devPath = path.resolve(__dirname, '../../native/macos/PrometheeBlockerHelper', name);
  if (fs.existsSync(devPath)) return devPath;

  const cwdPath = path.resolve(process.cwd(), 'native/macos/PrometheeBlockerHelper', name);
  if (fs.existsSync(cwdPath)) return cwdPath;

  return null;
}

function _buildInstallScript(helperSrc, plistSrc) {
  // Single-quote each path and escape any single-quotes within them (safe for sh)
  const q = (p) => `'${p.replace(/'/g, "'\\''")}'`;

  const lines = [
    `cp -f ${q(helperSrc)} ${q(HELPER_DST)}`,
    `chmod 755 ${q(HELPER_DST)}`,
    `chown root:wheel ${q(HELPER_DST)}`,
  ];

  if (plistSrc) {
    lines.push(
      `cp -f ${q(plistSrc)} ${q(LAUNCHD_DST)}`,
      `chmod 644 ${q(LAUNCHD_DST)}`,
      `chown root:wheel ${q(LAUNCHD_DST)}`,
      `launchctl unload ${q(LAUNCHD_DST)} 2>/dev/null || true`,
      `launchctl load ${q(LAUNCHD_DST)}`,
    );
  } else {
    // Fallback: write a minimal plist using a temp file (avoids echo quoting hell)
    const tmpPlist = `/tmp/promethee-helper-${Date.now()}.plist`;
    const plistXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0"><dict>',
      `<key>Label</key><string>${HELPER_ID}</string>`,
      `<key>ProgramArguments</key><array><string>${HELPER_DST}</string></array>`,
      '<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>',
      '</dict></plist>',
    ].join('\n');
    // Write plist via printf to avoid echo interpretation issues
    const safeXml = plistXml.replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/%/g, '%%');
    lines.push(
      `printf '${safeXml}' > ${q(tmpPlist)}`,
      `cp -f ${q(tmpPlist)} ${q(LAUNCHD_DST)}`,
      `chmod 644 ${q(LAUNCHD_DST)}`,
      `chown root:wheel ${q(LAUNCHD_DST)}`,
      `rm -f ${q(tmpPlist)}`,
      `launchctl unload ${q(LAUNCHD_DST)} 2>/dev/null || true`,
      `launchctl load ${q(LAUNCHD_DST)}`,
    );
  }

  return lines.join(' && ');
}

/**
 * Run a shell script with macOS administrator privileges via osascript.
 * Triggers the native "Promethee wants to make changes" password dialog.
 *
 * Key: we pass the script to osascript via execFile args (no shell interpolation),
 * then AppleScript embeds it in `do shell script "..."`. The only escaping needed
 * is for AppleScript's double-quoted string: backslashes and double-quotes.
 */
function _runWithAdmin(shellScript) {
  return new Promise((resolve) => {
    // Escape for AppleScript double-quoted string context
    const escaped = shellScript
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    const appleScript = `do shell script "${escaped}" with administrator privileges`;

    execFile('/usr/bin/osascript', ['-e', appleScript], { timeout: 60000 }, (err, _stdout, stderr) => {
      if (err) {
        if (err.message && (err.message.includes('-128') || (stderr && stderr.includes('-128')))) {
          resolve({ ok: false, error: 'Cancelled' });
        } else {
          const msg = (stderr || err.message || 'Installation failed').trim();
          console.error('[blocker] osascript error:', msg);
          resolve({ ok: false, error: msg });
        }
        return;
      }
      resolve({ ok: true });
    });
  });
}
