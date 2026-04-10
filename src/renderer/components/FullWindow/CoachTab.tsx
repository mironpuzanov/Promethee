import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatView, type Chat } from './ChatView';

export default function CoachTab() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.promethee.coach.getOrCreate().then((r: { success: boolean; chat?: Chat; error?: string }) => {
      if (r.success && r.chat) setChat(r.chat);
      else setError(r.error || 'Could not load coach.');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text-muted)', fontSize: 13 }}>
        <Sparkles size={24} strokeWidth={1.5} />
        <span>Connecting to your coach…</span>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <p>Could not load Mentor AI: {error}</p>
      </div>
    );
  }

  return <ChatView chat={chat} />;
}
