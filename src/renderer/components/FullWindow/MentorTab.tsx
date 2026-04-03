import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle } from 'lucide-react';

interface Chat {
  id: string;
  title: string;
  created_at: number;
  session_id?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
};

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ChatView({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.promethee.agent.getMessages(chat.id).then((r: { success: boolean; messages?: Message[] }) => {
      if (r.success) setMessages(r.messages || []);
    });
  }, [chat.id]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 32px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', zIndex: 200 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chat.title}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{formatDate(chat.created_at)}</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 }}>No messages in this conversation.</p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 4,
            }}
          >
            <div
              style={{
                maxWidth: '72%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                fontSize: 13,
                lineHeight: 1.6,
                background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.07)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
              {msg.role === 'user' ? 'You' : 'Mentor'} · {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default function MentorTab() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.promethee.agent.getChats().then((r: { success: boolean; chats?: Chat[] }) => {
      if (r.success) setChats((r.chats || []).sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    });
  }, []);

  if (selectedChat) {
    return <ChatView chat={selectedChat} onBack={() => setSelectedChat(null)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background)', padding: '40px', overflowY: 'auto', gap: 24, height: '100%', overflow: 'hidden auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--foreground)', margin: 0 }}>Mentor</h2>

      {loading && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Loading conversations…</p>
      )}

      {!loading && chats.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 48, color: 'rgba(255,255,255,0.25)' }}>
          <MessageCircle size={36} strokeWidth={1} />
          <p style={{ fontSize: 14, margin: 0 }}>No conversations yet.</p>
          <p style={{ fontSize: 13, margin: 0 }}>Start a session and chat with your Mentor from the overlay.</p>
        </div>
      )}

      {!loading && chats.length > 0 && (
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          {chats.map(chat => (
            <motion.button
              key={chat.id}
              variants={rowVariants}
              onClick={() => setSelectedChat(chat)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                gap: 12,
                textAlign: 'left',
                width: '100%',
              }}
              whileHover={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <MessageCircle size={16} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chat.title}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {formatDate(chat.created_at)}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
