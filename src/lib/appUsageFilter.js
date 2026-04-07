/**
 * Filter macOS / system surface apps from “Apps today” and session summaries.
 * Raw samples stay in SQLite; we only hide noise in UX and agent context.
 */

/** Lowercase display names from active-win `owner.name` */
const DENY_EXACT = new Set([
  'loginwindow',
  'windowserver',
  'dock',
  'system settings',
  'systemsettings',
  'system preferences',
  'control center',
  'controlcenter',
  'notification center',
  'notificationcenter',
  'spotlight',
  'screensaverengine',
  'software update',
  'systemuiserver',
  'windowmanager',
  'coreservicesuiagent',
  'talagent',
  'textinputmenuagent',
  'airplayuiagent',
  'universalcontrol',
  'softwareupdated',
  'login',
  'assistantd',
  'pkd',
  'coreaudiod',
  'wallpaper',
  'duetexperienced',
  'studentd',
  'usereventagent',
  'secinitd',
  'trustd',
]);

export function shouldIncludeAppInUsageStats(name) {
  const raw = typeof name === 'string' ? name.trim() : '';
  if (!raw) return false;
  return !DENY_EXACT.has(raw.toLowerCase());
}
