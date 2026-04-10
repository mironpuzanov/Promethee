import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatView, type Chat } from './ChatView';

export default function CoachTab() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const api = (window.promethee as any).coach;
      if (!api?.getOrCreate) {
        console.error('[CoachTab] coach API not found on window.promethee — preload needs refresh');
        setError('Restart the app to activate Mentor AI (preload needs a refresh).');
        setLoading(false);
        return;
      }
      console.log('[CoachTab] calling getOrCreate...');
      api.getOrCreate()
        .then((r: { success: boolean; chat?: Chat; error?: string }) => {
          console.log('[CoachTab] getOrCreate result:', r);
          if (r.success && r.chat) setChat(r.chat);
          else setError(r.error || 'Could not load Mentor AI');
          setLoading(false);
        })
        .catch((e: Error) => {
          console.error('[CoachTab] getOrCreate threw:', e);
          setError(e?.message || 'Could not connect to Mentor AI');
          setLoading(false);
        });
    } catch (e: unknown) {
      console.error('[CoachTab] sync error:', e);
      setError((e as Error)?.message || 'Mentor AI unavailable — restart the app');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text-muted)', fontSize: 13, background: 'var(--background)' }}>
        <Sparkles size={24} strokeWidth={1.5} />
        <span>Connecting to your coach…</span>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: 'var(--text-muted)', fontSize: 13, background: 'var(--background)' }}>
        <p>Could not load Mentor AI: {error}</p>
      </div>
    );
  }

  return <ChatView chat={chat} disableScreenCapture />;
}
