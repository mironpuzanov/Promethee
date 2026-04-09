import { app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase.js';

const UPDATE_CHANNEL = 'stable';
const FALLBACK_RELEASES_PAGE_URL = 'https://promethee.app';

let broadcastUpdateState = null;
let cachedPreferences = null;
let updateState = {
  status: 'idle',
  currentVersion: null,
  latestVersion: null,
  checkedAt: null,
  releaseUrl: FALLBACK_RELEASES_PAGE_URL,
  downloadUrl: FALLBACK_RELEASES_PAGE_URL,
  assetName: null,
  publishedAt: null,
  error: null,
  isSkipped: false,
};

function getPreferencesPath() {
  return path.join(app.getPath('userData'), 'update-preferences.json');
}

function readPreferences() {
  if (cachedPreferences) return cachedPreferences;

  try {
    const raw = fs.readFileSync(getPreferencesPath(), 'utf8');
    cachedPreferences = JSON.parse(raw);
  } catch {
    cachedPreferences = {};
  }

  return cachedPreferences;
}

function writePreferences(nextPreferences) {
  cachedPreferences = nextPreferences;
  fs.writeFileSync(getPreferencesPath(), JSON.stringify(nextPreferences, null, 2));
}

function cleanVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0];
}

export function compareVersions(a, b) {
  const aParts = cleanVersion(a)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const bParts = cleanVersion(b)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i += 1) {
    const aPart = aParts[i] ?? 0;
    const bPart = bParts[i] ?? 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }

  return 0;
}

export function pickReleaseAsset(assets = [], platform = process.platform) {
  const prioritiesByPlatform = {
    darwin: ['.dmg', '.zip'],
    win32: ['.exe', '.msi', '.zip'],
    linux: ['.appimage', '.deb', '.rpm', '.tar.gz', '.zip'],
  };
  const priorities = prioritiesByPlatform[platform] || ['.zip'];

  const normalizedAssets = Array.isArray(assets) ? assets : [];
  for (const suffix of priorities) {
    const match = normalizedAssets.find((asset) =>
      String(asset?.name || '').toLowerCase().endsWith(suffix)
    );
    if (match) return match;
  }

  return normalizedAssets[0] || null;
}

export function pickBestUpdateRow(rows = [], platform = process.platform) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const platformMatches = normalizedRows.filter((row) => row?.platform === platform);
  if (platformMatches.length > 0) return platformMatches[0];
  return normalizedRows.find((row) => row?.platform === 'all') || normalizedRows[0] || null;
}

function emitUpdateState() {
  if (broadcastUpdateState) {
    broadcastUpdateState(getUpdateState());
  }
}

function setUpdateState(partial) {
  updateState = {
    ...updateState,
    currentVersion: app.getVersion(),
    ...partial,
  };
  emitUpdateState();
  return getUpdateState();
}

export function setUpdateBroadcast(handler) {
  broadcastUpdateState = handler;
}

export function getUpdateState() {
  const preferences = readPreferences();
  return {
    ...updateState,
    currentVersion: app.getVersion(),
    isSkipped:
      Boolean(updateState.latestVersion) &&
      cleanVersion(preferences.skippedVersion) === cleanVersion(updateState.latestVersion),
  };
}

export async function checkForAppUpdate({ force = false } = {}) {
  if (!force && !app.isPackaged) {
    return setUpdateState({
      status: 'development',
      checkedAt: Date.now(),
      error: null,
    });
  }

  if (updateState.status === 'checking') {
    return getUpdateState();
  }

  setUpdateState({
    status: 'checking',
    error: null,
  });

  try {
    const { data, error } = await supabase
      .from('app_updates')
      .select('platform, channel, version, download_url, release_url, asset_name, published_at')
      .eq('channel', UPDATE_CHANNEL)
      .eq('active', true)
      .in('platform', [process.platform, 'all'])
      .order('published_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Supabase update manifest lookup failed');
    }

    const release = pickBestUpdateRow(data, process.platform);
    if (!release) {
      return setUpdateState({
        status: 'error',
        checkedAt: Date.now(),
        error: 'No active Supabase update manifest was found for this platform yet.',
      });
    }

    const latestVersion = cleanVersion(release.version || '');
    const releaseUrl = release.release_url || release.download_url || FALLBACK_RELEASES_PAGE_URL;
    const downloadUrl = release.download_url || release.release_url || FALLBACK_RELEASES_PAGE_URL;

    return setUpdateState({
      status: compareVersions(latestVersion, app.getVersion()) > 0 ? 'available' : 'up-to-date',
      latestVersion,
      checkedAt: Date.now(),
      releaseUrl,
      downloadUrl,
      assetName: release.asset_name || null,
      publishedAt: release.published_at || null,
      error: null,
    });
  } catch (error) {
    return setUpdateState({
      status: 'error',
      checkedAt: Date.now(),
      error: error instanceof Error ? error.message : 'Update check failed',
    });
  }
}

export function skipUpdateVersion(version = null) {
  const targetVersion = cleanVersion(version || updateState.latestVersion);
  const preferences = readPreferences();
  writePreferences({
    ...preferences,
    skippedVersion: targetVersion || null,
  });
  return getUpdateState();
}

export function clearSkippedUpdateVersion() {
  const preferences = readPreferences();
  const nextPreferences = { ...preferences };
  delete nextPreferences.skippedVersion;
  writePreferences(nextPreferences);
  return getUpdateState();
}

export async function openUpdateDownload() {
  const { downloadUrl, releaseUrl } = getUpdateState();
  const target = downloadUrl || releaseUrl || FALLBACK_RELEASES_PAGE_URL;
  await shell.openExternal(target);
  return { success: true, url: target };
}
