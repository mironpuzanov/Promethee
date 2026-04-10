import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Plus } from 'lucide-react';
import { ChatView, type Chat } from './ChatView';
import './MentorTab.css';

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
};

function formatTime(ts: number | undefined) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function groupByDay(chats: Chat[]): { label: string; chats: Chat[] }[] {
  const map = new Map<string, { label: string; chats: Chat[] }>();
  for (const chat of chats) {
    const label = dayLabel(chat.created_at);
    if (!map.has(label)) map.set(label, { label, chats: [] });
    map.get(label)!.chats.push(chat);
  }
  return Array.from(map.values());
}

export default function MentorTab() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    window.promethee.agent.getChats().then((r: { success: boolean; chats?: Chat[] }) => {
      if (r.success) setChats((r.chats || []).sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    });
  }, []);

  const handleNewChat = async () => {
    setCreating(true);
    const result = await window.promethee.agent.createChat(
      'New conversation', null,
      'You are the Promethee AI mentor. Help the user reflect on their work and stay focused. Answer concisely.'
    );
    setCreating(false);
    if (result.success && result.chat) {
      setChats(prev => [result.chat, ...prev]);
      setSelectedChat(result.chat);
    }
  };

  if (selectedChat) {
    return <ChatView chat={selectedChat} onBack={() => setSelectedChat(null)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background)', padding: '40px', overflowY: 'auto', gap: 24, height: '100%', overflow: 'hidden auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--foreground)', margin: 0 }}>Mentor</h2>
        <button type="button" onClick={handleNewChat} disabled={creating} className="mentor-header-btn--primary">
          <Plus size={14} />New chat
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading conversations…</p>}

      {!loading && chats.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 48, color: 'var(--text-muted)' }}>
          <MessageCircle size={36} strokeWidth={1} />
          <p style={{ fontSize: 14, margin: 0 }}>No conversations yet.</p>
          <p style={{ fontSize: 13, margin: 0 }}>Hit "New chat" to start talking with your Mentor.</p>
        </div>
      )}

      {!loading && chats.length > 0 && (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} initial="hidden" animate="visible" variants={listVariants}>
          {groupByDay(chats).map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <motion.div variants={rowVariants} style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, padding: '0 4px 4px' }}>
                {group.label}
              </motion.div>
              {group.chats.map(chat => (
                <motion.button key={chat.id} variants={rowVariants} type="button" onClick={() => setSelectedChat(chat)} className="mentor-list-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <MessageCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{formatTime(chat.created_at)}</span>
                </motion.button>
              ))}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
