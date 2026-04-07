import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Plus, Send, Monitor, X } from 'lucide-react';
import { getMentorLiveScreenEveryMessage, setMentorLiveScreenEveryMessage } from '../../lib/mentorLiveScreenPref';
import './MentorTab.css';

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
  const [screenshotAttached, setScreenshotAttached] = useState(false);
  const [liveScreenEveryMessage, setLiveScreenEveryMessage] = useState(getMentorLiveScreenEveryMessage);
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const streamingContentRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void window.promethee.window.clearPendingScreenCapture();
    setScreenshotAttached(false);
    setAttachError(null);
    window.promethee.agent.getMessages(chat.id).then((r: { success: boolean; messages?: Message[] }) => {
      if (r.success) setMessages(r.messages || []);
    });
  }, [chat.id]);

  useEffect(() => {
    if (messages.length > 0 || streamingContent || streaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, streaming]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const max = 168;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

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

  const clearScreenshot = () => {
    void window.promethee.window.clearPendingScreenCapture();
    setScreenshotAttached(false);
    setAttachError(null);
  };

  /** Grabs the current screen; the next message you send includes that image for the mentor. Click the monitor again (or Remove) to discard. */
  const toggleLiveScreen = () => {
    const next = !liveScreenEveryMessage;
    setLiveScreenEveryMessage(next);
    setMentorLiveScreenEveryMessage(next);
    if (next) clearScreenshot();
  };

  const handleAttachScreen = async () => {
    if (liveScreenEveryMessage) return;
    if (screenshotAttached) {
      clearScreenshot();
      return;
    }
    setAttachError(null);
    setCapturingScreen(true);
    const r = await window.promethee.window.captureScreen();
    setCapturingScreen(false);
    if (r.success) {
      setScreenshotAttached(true);
    } else {
      setAttachError(r.error || 'Could not capture screen.');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setStreaming(true);
    setAttachError(null);

    if (liveScreenEveryMessage) {
      const cap = await window.promethee.window.captureScreen();
      if (!cap.success) {
        setAttachError(cap.error || 'Could not capture screen.');
        setStreaming(false);
        return;
      }
    }

    setInput('');
    const history = messages;
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now() }]);
    if (!liveScreenEveryMessage) setScreenshotAttached(false);
    await window.promethee.agent.sendMessageWithImages(chat.id, content, [], history);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onBack}
            className="mentor-header-btn--ghost"
          >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chat.title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{formatTime(chat.created_at)}</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && !streaming && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
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
              background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {msg.role === 'user' ? 'You' : 'Mentor'} · {formatTime(msgTs(msg))}
            </span>
          </div>
        ))}
        {streaming && !streamingContent && (
          <div className="mentor-typing-wrap">
            <div className="mentor-typing-bubble" aria-label="Mentor is typing">
              <span className="mentor-typing-dot" />
              <span className="mentor-typing-dot" />
              <span className="mentor-typing-dot" />
            </div>
          </div>
        )}
        {streaming && streamingContent && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{
              maxWidth: '72%', padding: '10px 14px',
              borderRadius: '14px 14px 14px 4px',
              fontSize: 13, lineHeight: 1.6,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {streamingContent}
              <span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--text-secondary)', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1, animation: 'blink 1s step-end infinite' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="mentor-live-screen-row">
          <span className="mentor-live-screen-label">Include what's on your screen with every message</span>
          <button
            type="button"
            role="switch"
            aria-checked={liveScreenEveryMessage}
            className="mentor-live-screen-switch"
            onClick={toggleLiveScreen}
            disabled={streaming}
            title={liveScreenEveryMessage ? 'Turn off: only sends text unless you use the monitor button' : 'Turn on: captures desktop before each send'}
          >
            <span className="mentor-live-screen-switch-thumb" aria-hidden />
          </button>
        </div>
        {attachError && (
          <div
            className="mentor-screen-chip mentor-screen-chip--error"
            role="alert"
          >
            <span style={{ flex: 1, minWidth: 0 }}>{attachError}</span>
            <button
              type="button"
              className="mentor-screen-chip-remove"
              aria-label="Dismiss error"
              onClick={() => setAttachError(null)}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
        {screenshotAttached && !liveScreenEveryMessage && (
          <div
            className="mentor-screen-chip"
            title="Captures your display. The floating overlay hides briefly so the image isn’t only Promethee."
          >
            <Monitor size={11} />
            <span>Desktop included · next send</span>
            <button
              type="button"
              aria-label="Remove screen snapshot"
              className="mentor-screen-chip-remove"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearScreenshot();
              }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button
            type="button"
            onClick={handleAttachScreen}
            disabled={streaming || capturingScreen || liveScreenEveryMessage}
            title={
              liveScreenEveryMessage
                ? 'Turn off "every message" to queue a single capture instead'
                : screenshotAttached
                  ? 'Remove queued desktop snapshot'
                  : capturingScreen
                    ? 'Capturing…'
                    : 'Include desktop on next message (floating overlay hides briefly)'
            }
            className={`mentor-chat-attach${screenshotAttached ? ' mentor-chat-attach--active' : ''}`}
          >
            <Monitor size={15} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your mentor anything..."
            disabled={streaming}
            rows={1}
            className="mentor-chat-textarea"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="mentor-chat-send"
          >
            <Send size={15} />
          </button>
        </div>
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
          type="button"
          onClick={handleNewChat}
          disabled={creating}
          className="mentor-header-btn--primary"
        >
          <Plus size={14} />
          New chat
        </button>
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading conversations…</p>
      )}

      {!loading && chats.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 48, color: 'var(--text-muted)' }}>
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
                style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, padding: '0 4px 4px' }}
              >
                {group.label}
              </motion.div>
              {group.chats.map(chat => (
                <motion.button
                  key={chat.id}
                  variants={rowVariants}
                  type="button"
                  onClick={() => setSelectedChat(chat)}
                  className="mentor-list-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <MessageCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chat.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
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
