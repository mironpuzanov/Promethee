import React, { useState, useEffect, useRef } from 'react';
import { ShortcutField } from './ShortcutField';
import { MVP_MODE } from '../../../config/mvp';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string; avatar_url?: string };
}

interface SettingsTabProps {
  user: User | null;
  setUser: (user: User) => void;
}

interface UpdateState {
  status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'error' | 'development';
  currentVersion: string;
  latestVersion?: string | null;
  checkedAt?: number | null;
  releaseUrl?: string | null;
  downloadUrl?: string | null;
  assetName?: string | null;
  publishedAt?: string | null;
  error?: string | null;
  isSkipped?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
    />
  );
}

function SaveButton({ loading, label = 'Save' }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="self-start px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
    >
      {loading ? 'Saving…' : label}
    </button>
  );
}

function StatusMessage({ success, error }: { success?: string; error?: string }) {
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (success) return <p className="text-xs text-green-500">{success}</p>;
  return null;
}

interface BlockedDomain {
  id: string;
  domain: string;
  enabled: number;
  preset: number;
  position: number;
}

function SettingsTab({ user, setUser }: SettingsTabProps) {
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '');
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.user_metadata?.avatar_url || '');
  const [pendingFile, setPendingFile] = useState<{ buffer: ArrayBuffer; mimeType: string } | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ success?: string; error?: string }>({});
  const [profileLoading, setProfileLoading] = useState(false);

  // Website Blocker state
  const [blockerDomains, setBlockerDomains] = useState<BlockedDomain[]>([]);
  const [blockerStatus, setBlockerStatus] = useState<'active' | 'unavailable' | 'not-installed' | 'inactive'>('inactive');
  const [helperInstalled, setHelperInstalled] = useState<boolean | null>(null); // null = checking
  const [installerLoading, setInstallerLoading] = useState(false);
  const [installerStatus, setInstallerStatus] = useState<{ success?: string; error?: string }>({});
  const [newDomain, setNewDomain] = useState('');
  const [addDomainError, setAddDomainError] = useState('');
  const newDomainRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ success?: string; error?: string }>({});
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Screen recording permission state
  type ScreenRecordingStatus = 'loading' | 'granted' | 'acknowledged' | 'snoozed' | 'rejected' | 'not-set';
  const [screenRecordingStatus, setScreenRecordingStatus] = useState<ScreenRecordingStatus>('loading');
  const [screenRecordingProbing, setScreenRecordingProbing] = useState(false);

  const [focusShortcuts, setFocusShortcuts] = useState({
    focusOpenMentor: '',
    focusAddTask: '',
    focusEndSession: '',
  });
  const [focusShortcutStatus, setFocusShortcutStatus] = useState<{ success?: string; error?: string }>({});
  const [focusShortcutLoading, setFocusShortcutLoading] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '—',
  });
  const [updateActionStatus, setUpdateActionStatus] = useState<{ success?: string; error?: string }>({});

  useEffect(() => {
    window.promethee.shortcuts.get().then((r) => {
      if (r.success && r.shortcuts) setFocusShortcuts(r.shortcuts);
    });
  }, []);

  useEffect(() => {
    window.promethee.update.getState().then(setUpdateState);
    const unsub = window.promethee.update.onStatus(setUpdateState);
    return unsub;
  }, []);

  useEffect(() => {
    window.promethee.blocker.getDomains().then((r) => {
      if (r.success && r.domains) setBlockerDomains(r.domains as BlockedDomain[]);
    });
    window.promethee.blocker.checkInstall().then((r) => {
      setHelperInstalled(r.success ? r.installed : false);
    });
    const unsub = window.promethee.blocker.onStatus((data) => setBlockerStatus(data.state));
    return unsub;
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      // Check if active-win is actually working first
      const probe = await window.promethee.onboarding.probeScreenRecording();
      if (probe.ok) {
        setScreenRecordingStatus('granted');
        return;
      }
      // Not working — check what state we're in
      const r = await window.promethee.onboarding.getScreenRecordingStatus?.();
      setScreenRecordingStatus((r?.status as ScreenRecordingStatus) ?? 'not-set');
    };
    loadStatus();
  }, []);

  const handleScreenRecordingAllow = async () => {
    // Reset any prior state so the prompt can fire, then open Settings
    await window.promethee.onboarding.resetScreenRecording?.();
    setScreenRecordingStatus('not-set');
    await window.promethee.window.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    );
  };

  const handleScreenRecordingCheck = async () => {
    setScreenRecordingProbing(true);
    const probe = await window.promethee.onboarding.probeScreenRecording();
    setScreenRecordingProbing(false);
    if (probe.ok) {
      setScreenRecordingStatus('granted');
    } else {
      setScreenRecordingStatus('acknowledged');
    }
  };

  const handleScreenRecordingReset = async () => {
    await window.promethee.onboarding.resetScreenRecording?.();
    setScreenRecordingStatus('not-set');
  };

  const handleInstallHelper = async () => {
    setInstallerLoading(true);
    setInstallerStatus({});
    const r = await window.promethee.blocker.install();
    setInstallerLoading(false);
    if (r.ok) {
      setHelperInstalled(true);
      setInstallerStatus({ success: 'Website blocker installed successfully.' });
      // Re-check so running state is confirmed
      window.promethee.blocker.checkInstall().then((cr) => {
        setHelperInstalled(cr.success ? cr.installed : false);
      });
    } else if (r.error === 'Cancelled') {
      setInstallerStatus({});
    } else {
      setInstallerStatus({ error: r.error || 'Installation failed.' });
    }
  };

  const handleUninstallHelper = async () => {
    setInstallerLoading(true);
    setInstallerStatus({});
    const r = await window.promethee.blocker.uninstall();
    setInstallerLoading(false);
    if (r.ok) {
      setHelperInstalled(false);
      setInstallerStatus({ success: 'Website blocker removed.' });
    } else if (r.error === 'Cancelled') {
      setInstallerStatus({});
    } else {
      setInstallerStatus({ error: r.error || 'Removal failed.' });
    }
  };

  const handleToggleDomain = async (id: string, currentEnabled: number) => {
    const next = currentEnabled ? false : true;
    const r = await window.promethee.blocker.toggleDomain(id, next);
    if (r.success && r.domain) {
      setBlockerDomains((prev) => prev.map((d) => d.id === id ? { ...d, enabled: next ? 1 : 0 } : d));
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDomainError('');
    const trimmed = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!trimmed) return;
    const r = await window.promethee.blocker.addDomain(trimmed);
    if (r.success && r.domain) {
      setBlockerDomains((prev) => [...prev, r.domain as BlockedDomain]);
      setNewDomain('');
      newDomainRef.current?.focus();
    } else {
      setAddDomainError(r.error || 'Could not add domain.');
    }
  };

  const handleRemoveDomain = async (id: string) => {
    const r = await window.promethee.blocker.removeDomain(id);
    if (r.success) {
      setBlockerDomains((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Also read as ArrayBuffer for upload
    const bufReader = new FileReader();
    bufReader.onload = () => {
      setPendingFile({ buffer: bufReader.result as ArrayBuffer, mimeType: file.type });
    };
    bufReader.readAsArrayBuffer(file);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileStatus({});
    try {
      // Upload avatar first if a new file was picked
      if (pendingFile) {
        const uploadResult = await window.promethee.auth.uploadAvatar(pendingFile.buffer, pendingFile.mimeType);
        if (!uploadResult.success) {
          setProfileStatus({ error: uploadResult.error || 'Avatar upload failed.' });
          return;
        }
        if (uploadResult.user) setUser(uploadResult.user);
        setPendingFile(null);
      }

      const result = await window.promethee.auth.updateProfile({
        displayName: displayName.trim() || undefined,
      });
      if (result.success) {
        setProfileStatus({ success: 'Profile updated.' });
        if (result.user) setUser(result.user);
      } else {
        setProfileStatus({ error: result.error || 'Something went wrong.' });
      }
    } catch (err) {
      setProfileStatus({ error: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleFocusShortcutsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFocusShortcutLoading(true);
    setFocusShortcutStatus({});
    try {
      const api = window.promethee.shortcuts;
      if (!api?.set) {
        setFocusShortcutStatus({
          error: 'Shortcuts API unavailable — fully quit and restart Promethee (preload may be stale).',
        });
        return;
      }
      const payload = {
        focusOpenMentor: focusShortcuts.focusOpenMentor,
        focusAddTask: focusShortcuts.focusAddTask,
        focusEndSession: focusShortcuts.focusEndSession,
      };
      const result = await api.set(payload);
      if (result.success) {
        setFocusShortcutStatus({ success: 'Focus shortcuts updated.' });
        if (result.shortcuts) setFocusShortcuts(result.shortcuts);
      } else {
        setFocusShortcutStatus({ error: result.error || 'Could not save shortcuts.' });
      }
    } catch (err) {
      setFocusShortcutStatus({ error: err instanceof Error ? err.message : 'Could not save shortcuts.' });
    } finally {
      setFocusShortcutLoading(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ error: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ error: 'Password must be at least 6 characters.' });
      return;
    }
    setPasswordLoading(true);
    setPasswordStatus({});
    try {
      const result = await window.promethee.auth.updatePassword(newPassword);
      if (result.success) {
        setPasswordStatus({ success: 'Password updated.' });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ error: result.error || 'Something went wrong.' });
      }
    } catch (err) {
      setPasswordStatus({ error: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCheckForUpdates = async () => {
    setUpdateActionStatus({});
    const nextState = await window.promethee.update.check(true);
    setUpdateState(nextState);
  };

  const handleOpenUpdateDownload = async () => {
    setUpdateActionStatus({});
    const result = await window.promethee.update.openDownload();
    if (!result.success) {
      setUpdateActionStatus({ error: result.error || 'Could not open the download page.' });
      return;
    }
    setUpdateActionStatus({ success: 'Opened the latest release download.' });
  };

  const handleSkipVersion = async () => {
    setUpdateActionStatus({});
    const nextState = await window.promethee.update.skipVersion(updateState.latestVersion || null);
    setUpdateState(nextState);
    setUpdateActionStatus({ success: `Promethee will stop prompting for v${nextState.latestVersion}.` });
  };

  const handleClearSkippedVersion = async () => {
    setUpdateActionStatus({});
    const nextState = await window.promethee.update.clearSkippedVersion();
    setUpdateState(nextState);
    setUpdateActionStatus({ success: 'Update prompts restored.' });
  };

  const checkedAtLabel = updateState.checkedAt
    ? new Date(updateState.checkedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-10 h-full">
      <h2 className="text-2xl font-light text-foreground">Settings</h2>

      <div className="border-t border-border" />

      {/* Profile */}
      <Section title="Profile">
        <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
          <Field label="Display name">
            <Input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Avatar">
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-12 h-12 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground text-xs">
                  none
                </div>
              )}
              <label className="cursor-pointer px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors">
                {avatarPreview ? 'Change photo' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarPick}
                />
              </label>
              {pendingFile && (
                <span className="text-xs text-muted-foreground">Unsaved</span>
              )}
            </div>
          </Field>
          <StatusMessage {...profileStatus} />
          <SaveButton loading={profileLoading} />
        </form>
      </Section>

      <div className="border-t border-border" />

      {/* Account */}
      <Section title="Account">
        <Field label="Email">
          <Input type="email" value={user?.email || ''} disabled />
        </Field>
      </Section>

      <div className="border-t border-border" />

      <Section title="Focus shortcuts">
        <p className="text-xs text-muted-foreground -mt-1 max-w-xl">
          Global shortcuts work even when another app is focused. They target the focus overlay (mentor, session tasks,
          end session). Leave a field empty to disable that shortcut. Use Electron syntax, e.g.{' '}
          <code className="text-foreground/80">CommandOrControl+Alt+M</code>.
        </p>
        <form onSubmit={handleFocusShortcutsSave} className="flex flex-col gap-4">
          <Field label="Open mentor chat and focus input">
            <ShortcutField
              value={focusShortcuts.focusOpenMentor}
              onChange={(v) => setFocusShortcuts((s) => ({ ...s, focusOpenMentor: v }))}
            />
          </Field>
          <Field label="Focus add-task field (during an active session)">
            <ShortcutField
              value={focusShortcuts.focusAddTask}
              onChange={(v) => setFocusShortcuts((s) => ({ ...s, focusAddTask: v }))}
            />
          </Field>
          <Field label="End focus session">
            <ShortcutField
              value={focusShortcuts.focusEndSession}
              onChange={(v) => setFocusShortcuts((s) => ({ ...s, focusEndSession: v }))}
            />
          </Field>
          <StatusMessage {...focusShortcutStatus} />
          <SaveButton loading={focusShortcutLoading} label="Save shortcuts" />
        </form>
      </Section>

      <div className="border-t border-border" />

      <Section title="App updates">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-foreground">Current version: v{updateState.currentVersion}</p>
              {updateState.status === 'available' && (
                <p className="text-xs text-muted-foreground">
                  v{updateState.latestVersion} is available{updateState.assetName ? ` (${updateState.assetName})` : ''}.
                </p>
              )}
              {updateState.status === 'up-to-date' && (
                <p className="text-xs text-muted-foreground">You are on the latest released build.</p>
              )}
              {updateState.status === 'checking' && (
                <p className="text-xs text-muted-foreground">Checking Promethee update manifest…</p>
              )}
              {updateState.status === 'development' && (
                <p className="text-xs text-muted-foreground">
                  Automatic prompts only run in packaged builds. Manual checks still work here.
                </p>
              )}
              {updateState.status === 'error' && (
                <p className="text-xs text-destructive">{updateState.error || 'Update check failed.'}</p>
              )}
              {updateState.isSkipped && updateState.latestVersion && (
                <p className="text-xs text-muted-foreground">v{updateState.latestVersion} is currently ignored.</p>
              )}
              {checkedAtLabel && (
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  Last checked {checkedAtLabel}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={updateState.status === 'checking'}
              className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
            >
              {updateState.status === 'checking' ? 'Checking…' : 'Check now'}
            </button>
          </div>
          {updateState.status === 'available' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenUpdateDownload}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
              >
                Download update
              </button>
              {updateState.isSkipped ? (
                <button
                  type="button"
                  onClick={handleClearSkippedVersion}
                  className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
                >
                  Restore prompts
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSkipVersion}
                  className="px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
                >
                  Skip this version
                </button>
              )}
            </div>
          )}
          <StatusMessage {...updateActionStatus} />
        </div>
      </Section>

      {!MVP_MODE && <div className="border-t border-border" />}

      {/* Website Blocker — hidden in MVP_MODE */}
      {!MVP_MODE && <Section title="Website blocker">
        <p className="text-xs text-muted-foreground -mt-1 max-w-xl">
          Blocks distracting websites system-wide during focus sessions — Safari, Chrome, Arc, Firefox, all covered.
          Takes a few seconds to take effect after session starts (DNS cache).
        </p>

        {/* Install card — shown while checking or when not installed */}
        {(helperInstalled === null || helperInstalled === false) && (
          <div className="rounded-xl border border-border/60 bg-card px-4 py-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {helperInstalled === null ? 'Checking…' : 'One-time setup required'}
                </p>
                {helperInstalled === false && (
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Promethee needs a small background helper that runs as a system service.
                    You'll see a standard macOS password prompt — nothing else is installed.
                  </p>
                )}
              </div>
              {helperInstalled === false && (
                <button
                  type="button"
                  onClick={handleInstallHelper}
                  disabled={installerLoading}
                  className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {installerLoading ? 'Installing…' : 'Install blocker'}
                </button>
              )}
            </div>
            {installerStatus.error && <p className="text-xs text-destructive">{installerStatus.error}</p>}
            {installerStatus.success && <p className="text-xs text-green-500">{installerStatus.success}</p>}
          </div>
        )}

        {/* Installed — show status + controls */}
        {helperInstalled === true && (
          <>
            {/* Status row */}
            <div className="flex items-center gap-2">
              {blockerStatus === 'active' ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" /><span className="text-xs text-green-500">Blocking active</span></>
              ) : blockerStatus === 'unavailable' ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" /><span className="text-xs text-yellow-500">Helper not responding</span></>
              ) : (
                <><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" /><span className="text-xs text-muted-foreground/60">Ready — activates when you start a session</span></>
              )}
            </div>
            {installerStatus.error && <p className="text-xs text-destructive">{installerStatus.error}</p>}
            {installerStatus.success && <p className="text-xs text-green-500">{installerStatus.success}</p>}

            {/* Domain list */}
            <div className="flex flex-col rounded-xl overflow-hidden border border-border/40">
              {blockerDomains.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-border/30' : ''}`}
                >
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleDomain(d.id, d.enabled)}
                    aria-label={d.enabled ? 'Disable' : 'Enable'}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      flexShrink: 0,
                      position: 'relative',
                      background: d.enabled ? 'hsl(var(--accent))' : 'hsl(var(--muted))',
                      transition: 'background 0.15s',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: 3,
                      left: d.enabled ? 19 : 3,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      transition: 'left 0.15s',
                      display: 'block',
                    }} />
                  </button>

                  {/* Domain name */}
                  <span className={`text-sm flex-1 ${d.enabled ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                    {d.domain}
                  </span>

                  {/* Right side: preset label or remove button */}
                  {d.preset ? (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/30 font-medium">
                      Default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(d.id)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors text-base leading-none"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add domain */}
            <form onSubmit={handleAddDomain} className="flex gap-2 items-center">
              <input
                ref={newDomainRef}
                type="text"
                value={newDomain}
                onChange={(e) => { setNewDomain(e.target.value); setAddDomainError(''); }}
                placeholder="Add a domain, e.g. linkedin.com"
                className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-ring transition-colors"
              />
              <button
                type="submit"
                disabled={!newDomain.trim()}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                Add
              </button>
            </form>
            {addDomainError && <p className="text-xs text-destructive">{addDomainError}</p>}

            <button
              type="button"
              onClick={handleUninstallHelper}
              disabled={installerLoading}
              className="self-start text-xs text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-50 pt-1"
            >
              {installerLoading ? 'Removing…' : 'Remove blocker helper'}
            </button>
          </>
        )}
      </Section>}

      <div className="border-t border-border" />

      {/* Permissions */}
      <Section title="Permissions">
        <div className="flex flex-col rounded-xl border border-border/60 bg-card px-4 py-4 gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Screen Recording</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Reads which app is in front to track focus time. Window titles only — no video.
              </p>
              {screenRecordingStatus === 'granted' && (
                <p className="text-xs text-green-500 mt-0.5">Granted — tracking is active</p>
              )}
              {screenRecordingStatus === 'acknowledged' && (
                <p className="text-xs text-yellow-500 mt-0.5">Enabled in Settings — quit and reopen Promethee to apply</p>
              )}
              {screenRecordingStatus === 'snoozed' && (
                <p className="text-xs text-muted-foreground mt-0.5">Reminder snoozed</p>
              )}
              {screenRecordingStatus === 'rejected' && (
                <p className="text-xs text-muted-foreground mt-0.5">Not allowed</p>
              )}
              {screenRecordingStatus === 'not-set' && (
                <p className="text-xs text-muted-foreground mt-0.5">Not yet allowed</p>
              )}
              {screenRecordingStatus === 'loading' && (
                <p className="text-xs text-muted-foreground mt-0.5">Checking…</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {/* Main action button */}
              {screenRecordingStatus === 'granted' ? (
                <button
                  type="button"
                  onClick={handleScreenRecordingReset}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
                >
                  Reset
                </button>
              ) : screenRecordingStatus === 'acknowledged' ? (
                <button
                  type="button"
                  onClick={handleScreenRecordingCheck}
                  disabled={screenRecordingProbing}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {screenRecordingProbing ? 'Checking…' : 'I\'ve restarted — check now'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleScreenRecordingAllow}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
                >
                  Allow in Settings
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <div className="border-t border-border" />

      {/* Password */}
      <Section title="Change password">
        <form onSubmit={handlePasswordSave} className="flex flex-col gap-4">
          <Field label="New password">
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password">
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          <StatusMessage {...passwordStatus} />
          <SaveButton loading={passwordLoading} label="Update password" />
        </form>
      </Section>
    </div>
  );
}

export default SettingsTab;
