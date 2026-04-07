import React, { useState, useEffect } from 'react';
import { ShortcutField } from './ShortcutField';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string; avatar_url?: string };
}

interface SettingsTabProps {
  user: User | null;
  setUser: (user: User) => void;
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

function SettingsTab({ user, setUser }: SettingsTabProps) {
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '');
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.user_metadata?.avatar_url || '');
  const [pendingFile, setPendingFile] = useState<{ buffer: ArrayBuffer; mimeType: string } | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ success?: string; error?: string }>({});
  const [profileLoading, setProfileLoading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ success?: string; error?: string }>({});
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [focusShortcuts, setFocusShortcuts] = useState({
    focusOpenMentor: '',
    focusAddTask: '',
    focusEndSession: '',
  });
  const [focusShortcutStatus, setFocusShortcutStatus] = useState<{ success?: string; error?: string }>({});
  const [focusShortcutLoading, setFocusShortcutLoading] = useState(false);

  useEffect(() => {
    window.promethee.shortcuts.get().then((r) => {
      if (r.success && r.shortcuts) setFocusShortcuts(r.shortcuts);
    });
  }, []);

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

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-10 h-full">
      <h2 className="text-2xl font-light text-foreground">Settings</h2>

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
