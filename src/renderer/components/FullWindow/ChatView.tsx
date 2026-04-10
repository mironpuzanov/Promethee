import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Monitor, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMentorLiveScreenEveryMessage, setMentorLiveScreenEveryMessage } from '../../lib/mentorLiveScreenPref';
import './MentorTab.css';

export interface Chat {
  id: string;
  title: string;
  created_at: number;
  session_id?: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: number;
  createdAt?: number;
}

function formatTime(ts: number | undefined) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function msgTs(msg: Message): number {
  return msg.created_at ?? msg.createdAt ?? Date.now();
}

interface ChatViewProps {
  chat: Chat;
  onBack?: () => void;
  backLabel?: string;
  disableScreenCapture?: boolean;
}

function friendlyAiError(raw?: string): string {
  if (!raw) return "Something went wrong — couldn't get a response. Try again.";
  const lower = raw.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('quota'))
    return "We've hit our AI rate limit. Try again in a moment — we're on it.";
  if (lower.includes('context_length') || lower.includes('too long') || lower.includes('max tokens'))
    return 'This conversation is too long. Start a new chat to continue.';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('econnrefused') || lower.includes('failed to fetch'))
    return "Can't reach the AI service — check your connection and try again.";
  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('forbidden') || lower.includes('403'))
    return 'Session expired. Sign out and sign back in.';
  if (lower.includes('500') || lower.includes('internal server'))
    return "The AI service is having issues right now. We're aware — try again shortly.";
  return "Something went wrong — couldn't get a response. Try again.";
}

export function ChatView({ chat, onBack, backLabel, disableScreenCapture = false }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [screenshotAttached, setScreenshotAttached] = useState(false);
  const [liveScreenEveryMessage, setLiveScreenEveryMessage] = useState(
    disableScreenCapture ? false : getMentorLiveScreenEveryMessage
  );
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const streamingContentRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoadingMessages(true);
    void window.promethee.window.clearPendingScreenCapture();
    setScreenshotAttached(false);
    setAttachError(null);
    window.promethee.agent.getMessages(chat.id).then((r: { success: boolean; messages?: Message[] }) => {
      if (r.success) setMessages(r.messages || []);
      setLoadingMessages(false);
    }).catch(() => setLoadingMessages(false));
    return () => { void window.promethee.agent.summarizeChat(chat.id); };
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
    el.style.height = '42px';
    el.style.height = `${Math.max(42, Math.min(el.scrollHeight, 168))}px`;
  }, []);

  useLayoutEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);

  useEffect(() => {
    const removeChunk = window.promethee.agent.onChunk(({ chatId, delta }: { chatId: string; delta: string }) => {
      if (chatId === chat.id) {
        streamingContentRef.current += delta;
        setStreamingContent(streamingContentRef.current);
      }
    });
    const removeEnd = window.promethee.agent.onStreamEnd(({ chatId, message }: { chatId: string; message: Message }) => {
      if (chatId === chat.id) {
        if (message?.id) setMessages(prev => [...prev, message]);
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
      }
    });
    const removeError = window.promethee.agent.onStreamError(({ chatId, error: err }: { chatId: string; error?: string }) => {
      if (chatId === chat.id) {
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
        setChatError(friendlyAiError(err));
      }
    });
    return () => { removeChunk(); removeEnd(); removeError(); };
  }, [chat.id]);

  const clearScreenshot = () => {
    void window.promethee.window.clearPendingScreenCapture();
    setScreenshotAttached(false);
    setAttachError(null);
  };

  const toggleLiveScreen = () => {
    const next = !liveScreenEveryMessage;
    setLiveScreenEveryMessage(next);
    setMentorLiveScreenEveryMessage(next);
    if (next) clearScreenshot();
  };

  const handleAttachScreen = async () => {
    if (liveScreenEveryMessage) return;
    if (screenshotAttached) { clearScreenshot(); return; }
    setAttachError(null);
    setCapturingScreen(true);
    const r = await window.promethee.window.captureScreen();
    setCapturingScreen(false);
    if (r.success) setScreenshotAttached(true);
    else setAttachError(r.error || 'Could not capture screen.');
  };

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setStreaming(true);
    setAttachError(null);
    setChatError(null);
    try {
      if (!disableScreenCapture && liveScreenEveryMessage) {
        const cap = await window.promethee.window.captureScreen();
        if (!cap.success) { setAttachError(cap.error || 'Could not capture screen.'); setStreaming(false); return; }
      }
      setInput('');
      const history = messages;
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now() }]);
      if (!liveScreenEveryMessage) setScreenshotAttached(false);
      await window.promethee.agent.sendMessageWithImages(chat.id, content, [], history);
    } catch (e: unknown) {
      setStreaming(false);
      setChatError((e as Error)?.message || 'Failed to send — try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', minHeight: 0, background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {onBack && (
          <button type="button" onClick={onBack} className="mentor-header-btn--ghost" title={backLabel ?? 'Back'}>
            <ArrowLeft size={18} />
          </button>
        )}
        {backLabel && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{backLabel}</span>
        )}
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chat.title === '__coach__' ? 'Mentor AI' : chat.title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{formatTime(chat.created_at)}</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loadingMessages && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
            Loading…
          </p>
        )}
        {!loadingMessages && messages.length === 0 && !streaming && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
            Start the conversation — ask anything.
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <div style={{
              maxWidth: '72%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              fontSize: 13, lineHeight: 1.6,
              background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'var(--surface)',
              color: 'var(--text-primary)', border: '1px solid var(--border)', wordBreak: 'break-word',
            }}>
              {msg.role === 'user' ? (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} className="mentor-markdown">{msg.content}</ReactMarkdown>
              )}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {msg.role === 'user' ? 'You' : 'Mentor'} · {formatTime(msgTs(msg))}
            </span>
          </div>
        ))}
        {streaming && !streamingContent && (
          <div className="mentor-typing-wrap">
            <div className="mentor-typing-bubble" aria-label="Mentor is typing">
              <span className="mentor-typing-dot" /><span className="mentor-typing-dot" /><span className="mentor-typing-dot" />
            </div>
          </div>
        )}
        {streaming && streamingContent && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: '14px 14px 14px 4px', fontSize: 13, lineHeight: 1.6, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', wordBreak: 'break-word' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="mentor-markdown">{streamingContent}</ReactMarkdown>
              <span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--text-secondary)', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1, animation: 'blink 1s step-end infinite' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {!disableScreenCapture && (
          <div className="mentor-live-screen-row">
            <span className="mentor-live-screen-label">Include what's on your screen with every message</span>
            <button type="button" role="switch" aria-checked={liveScreenEveryMessage} className="mentor-live-screen-switch" onClick={toggleLiveScreen} disabled={streaming}>
              <span className="mentor-live-screen-switch-thumb" aria-hidden />
            </button>
          </div>
        )}
        {chatError && (
          <div className="mentor-screen-chip mentor-screen-chip--error" role="alert" style={{ marginBottom: 6 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{chatError}</span>
            <button type="button" className="mentor-screen-chip-remove" aria-label="Dismiss error" onClick={() => setChatError(null)}><X size={14} strokeWidth={2} /></button>
          </div>
        )}
        {attachError && (
          <div className="mentor-screen-chip mentor-screen-chip--error" role="alert">
            <span style={{ flex: 1, minWidth: 0 }}>{attachError}</span>
            <button type="button" className="mentor-screen-chip-remove" aria-label="Dismiss error" onClick={() => setAttachError(null)}><X size={14} strokeWidth={2} /></button>
          </div>
        )}
        {screenshotAttached && !liveScreenEveryMessage && (
          <div className="mentor-screen-chip" title="Captures your display. The floating overlay hides briefly so the image isn't only Promethee.">
            <Monitor size={11} />
            <span>Desktop included · next send</span>
            <button type="button" aria-label="Remove screen snapshot" className="mentor-screen-chip-remove" onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearScreenshot(); }}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {!disableScreenCapture && (
            <button
              type="button" onClick={handleAttachScreen}
              disabled={streaming || capturingScreen || liveScreenEveryMessage}
              title={liveScreenEveryMessage ? 'Turn off "every message" to queue a single capture' : screenshotAttached ? 'Remove queued desktop snapshot' : capturingScreen ? 'Capturing…' : 'Include desktop on next message'}
              className={`mentor-chat-attach${screenshotAttached ? ' mentor-chat-attach--active' : ''}`}
            >
              <Monitor size={15} />
            </button>
          )}
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask your mentor anything..." disabled={streaming} rows={1} className="mentor-chat-textarea" />
          <button type="button" onClick={handleSend} disabled={!input.trim() || streaming} className="mentor-chat-send">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
