import React, { useState } from 'react';

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

    // Upload avatar first if a new file was picked
    if (pendingFile) {
      const uploadResult = await window.promethee.auth.uploadAvatar(pendingFile.buffer, pendingFile.mimeType);
      if (!uploadResult.success) {
        setProfileLoading(false);
        setProfileStatus({ error: uploadResult.error || 'Avatar upload failed.' });
        return;
      }
      if (uploadResult.user) setUser(uploadResult.user);
      setPendingFile(null);
    }

    // Save display name (always, in case only name changed)
    const result = await window.promethee.auth.updateProfile({
      displayName: displayName.trim() || undefined,
    });
    setProfileLoading(false);
    if (result.success) {
      setProfileStatus({ success: 'Profile updated.' });
      if (result.user) setUser(result.user);
    } else {
      setProfileStatus({ error: result.error || 'Something went wrong.' });
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
    const result = await window.promethee.auth.updatePassword(newPassword);
    setPasswordLoading(false);
    if (result.success) {
      setPasswordStatus({ success: 'Password updated.' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordStatus({ error: result.error || 'Something went wrong.' });
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
