import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Plus, Send } from 'lucide-react';

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
  created_at?: number;
  createdAt?: number;
}

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

function msgTs(msg: Message): number {
  return msg.created_at ?? msg.createdAt ?? Date.now();
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

function ChatView({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const streamingContentRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    window.promethee.agent.getMessages(chat.id).then((r: { success: boolean; messages?: Message[] }) => {
      if (r.success) setMessages(r.messages || []);
    });
  }, [chat.id]);

  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const removeChunk = window.promethee.agent.onChunk(({ chatId, delta }: { chatId: string; delta: string }) => {
      if (chatId === chat.id) {
        streamingContentRef.current += delta;
        setStreamingContent(streamingContentRef.current);
      }
    });
    const removeEnd = window.promethee.agent.onStreamEnd(({ chatId, message }: { chatId: string; message: Message }) => {
      if (chatId === chat.id) {
        setMessages(prev => [...prev, message]);
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
      }
    });
    const removeError = window.promethee.agent.onStreamError(({ chatId }: { chatId: string }) => {
      if (chatId === chat.id) {
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
      }
    });
    return () => { removeChunk(); removeEnd(); removeError(); };
  }, [chat.id]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setInput('');
    setStreaming(true);
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now() }]);
    await window.promethee.agent.sendMessage(chat.id, content, messages);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 32px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chat.title}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{formatTime(chat.created_at)}</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && !streaming && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 }}>
            Start the conversation — ask anything.
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <div style={{
              maxWidth: '72%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              fontSize: 13, lineHeight: 1.6,
              background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.07)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
              {msg.role === 'user' ? 'You' : 'Mentor'} · {formatTime(msgTs(msg))}
            </span>
          </div>
        ))}
        {streaming && !streamingContent && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{
              padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.35)',
                  display: 'inline-block',
                  animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        {streaming && streamingContent && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{
              maxWidth: '72%', padding: '10px 14px',
              borderRadius: '14px 14px 14px 4px',
              fontSize: 13, lineHeight: 1.6,
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.07)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {streamingContent}
              <span style={{ display: 'inline-block', width: 6, height: 12, background: 'rgba(255,255,255,0.4)', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1, animation: 'blink 1s step-end infinite' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your mentor anything..."
          disabled={streaming}
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '10px 14px',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: input.trim() && !streaming ? '#E8922A' : 'rgba(255,255,255,0.06)',
            border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: input.trim() && !streaming ? '#000' : 'rgba(255,255,255,0.2)',
            transition: 'background 0.15s',
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
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
      'New conversation',
      null,
      `You are the Promethee AI mentor. Help the user reflect on their work and stay focused. Answer concisely.`
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--foreground)', margin: 0 }}>Mentor</h2>
        <button
          onClick={handleNewChat}
          disabled={creating}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '8px 14px',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={14} />
          New chat
        </button>
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Loading conversations…</p>
      )}

      {!loading && chats.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 48, color: 'rgba(255,255,255,0.25)' }}>
          <MessageCircle size={36} strokeWidth={1} />
          <p style={{ fontSize: 14, margin: 0 }}>No conversations yet.</p>
          <p style={{ fontSize: 13, margin: 0 }}>Hit "New chat" to start talking with your Mentor.</p>
        </div>
      )}

      {!loading && chats.length > 0 && (
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          {groupByDay(chats).map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <motion.div
                variants={rowVariants}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, padding: '0 4px 4px' }}
              >
                {group.label}
              </motion.div>
              {group.chats.map(chat => (
                <motion.button
                  key={chat.id}
                  variants={rowVariants}
                  onClick={() => setSelectedChat(chat)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer', gap: 12, textAlign: 'left', width: '100%',
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
                    {formatTime(chat.created_at)}
                  </span>
                </motion.button>
              ))}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
