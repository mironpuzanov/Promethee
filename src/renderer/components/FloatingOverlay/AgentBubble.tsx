import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';

function friendlyAiError(raw?: string): string {
  if (!raw) return "Something went wrong — couldn't get a response. Try again.";
  const lower = raw.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('quota'))
    return "AI rate limit hit. Try again in a moment — we're on it.";
  if (lower.includes('context_length') || lower.includes('too long') || lower.includes('max tokens'))
    return 'Conversation too long. Start a new chat to continue.';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('econnrefused') || lower.includes('failed to fetch'))
    return "Can't reach the AI service — check your connection.";
  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('forbidden') || lower.includes('403'))
    return 'Session expired. Sign out and back in.';
  if (lower.includes('500') || lower.includes('internal server'))
    return "AI service is having issues. We're aware — try again shortly.";
  return "Something went wrong — couldn't get a response. Try again.";
}
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMentorLiveScreenEveryMessage, setMentorLiveScreenEveryMessage } from '../../lib/mentorLiveScreenPref';
import { overlaySuppressHitTest, overlayRestoreClickThrough } from '../../lib/overlayMouseBridge';
import './AgentBubble.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

interface Chat {
  id: string;
  title: string;
  systemPrompt: string;
}

interface AgentBubbleProps {
  activeSession: { id: string; task?: string; startedAt: number } | null;
  openTrigger?: number;
  toggleTrigger?: number;
}

interface AttachedImage {
  objectUrl: string;
  file: File;
}

const BUBBLE_H = 32;
const RIGHT_MARGIN = 24;
const TOP_MARGIN = 24;
const BOTTOM_MARGIN = 24;
const STORAGE_KEY = 'agentBubbleBottomY';
const PANEL_SIZE_KEY = 'agentPanelSize';
const MIN_W = 260;
const MAX_W = 600;
const MIN_H = 220;
const MAX_H = 800;

function loadPanelSize(): { w: number; h: number } {
  try {
    const s = localStorage.getItem(PANEL_SIZE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { w: 320, h: Math.round(window.innerHeight * 0.5) };
}

function loadBottomY(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return Number(stored);
  } catch {}
  return BOTTOM_MARGIN;
}

function clampBottomY(v: number): number {
  return Math.max(BOTTOM_MARGIN, Math.min(window.innerHeight - TOP_MARGIN - BUBBLE_H, v));
}

function buildSystemPrompt(session: AgentBubbleProps['activeSession']): string {
  if (!session) {
    return `You are the Promethee AI agent. The user is between focus sessions right now.
Answer concisely. Ask what they're working on if relevant.`;
  }
  const elapsedMinutes = Math.floor((Date.now() - session.startedAt) / 60000);
  return `You are the Promethee AI agent. You help users stay focused and get unstuck without leaving their work.

Current session: "${session.task || 'Unknown task'}" — ${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} in.

Answer concisely. You already know what they're working on — don't ask them to re-explain.`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AgentBubble({ activeSession, openTrigger = 0, toggleTrigger = 0 }: AgentBubbleProps) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [allChats, setAllChats] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
  const [bottomY, setBottomY] = useState<number>(loadBottomY);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [panelSize, setPanelSize] = useState(loadPanelSize);
  const [screenSnapQueued, setScreenSnapQueued] = useState(false);
  const [liveScreenEveryMessage, setLiveScreenEveryMessage] = useState(getMentorLiveScreenEveryMessage);
  const [screenCaptureError, setScreenCaptureError] = useState<string | null>(null);
  const [capturingScreen, setCapturingScreen] = useState(false);

  const isDragging = useRef(false);
  const didMove = useRef(false);
  const dragStartClientY = useRef(0);
  const dragStartBottomY = useRef(0);
  const bottomYRef = useRef(bottomY);
  const panelSizeRef = useRef(panelSize);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartW = useRef(0);
  const resizeStartH = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomYRef.current = bottomY; }, [bottomY]);
  useEffect(() => { panelSizeRef.current = panelSize; }, [panelSize]);

  useEffect(() => {
    if (openTrigger > 0) setOpen(true);
  }, [openTrigger]);

  useEffect(() => {
    if (toggleTrigger > 0) setOpen((prev) => !prev);
  }, [toggleTrigger]);

  useEffect(() => {
    if (openTrigger <= 0 || !open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [openTrigger, open]);

  useEffect(() => {
    return () => { attachedImages.forEach(img => URL.revokeObjectURL(img.objectUrl)); };
  }, []);

  const initChat = useCallback(async () => {
    const result = await window.promethee.agent.getOrCreateChat(
      activeSession?.task || 'Quick chat',
      activeSession?.id || null,
      buildSystemPrompt(activeSession)
    );
    if (!result.success) { setError('Could not load chat history.'); return; }
    const msgResult = await window.promethee.agent.getMessages(result.chat.id);
    setChat(result.chat);
    setMessages(msgResult.success ? (msgResult.messages || []) : []);
  }, [activeSession?.id]);

  useEffect(() => { initChat(); }, [initChat]);

  useEffect(() => {
    if (!chat?.id) return;
    void window.promethee.window.clearPendingScreenCapture();
    setScreenSnapQueued(false);
    setScreenCaptureError(null);
  }, [chat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streaming]);

  const resizeInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '32px';
    const max = 120;
    el.style.height = `${Math.max(32, Math.min(el.scrollHeight, max))}px`;
  }, []);

  useLayoutEffect(() => {
    resizeInput();
  }, [input, resizeInput]);

  useEffect(() => {
    if (open) {
      window.promethee.window.setFocusable(true);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    window.promethee.window.setFocusable(false);
    void window.promethee.window.clearPendingScreenCapture();
    setScreenSnapQueued(false);
    setScreenCaptureError(null);
    // Summarize chat in background when panel closes (if it has messages)
    if (chatIdRef.current && messages.length >= 2) {
      void window.promethee.agent.summarizeChat(chatIdRef.current);
    }
  }, [open]);

  const chatIdRef = useRef<string | null>(null);
  useEffect(() => { chatIdRef.current = chat?.id ?? null; }, [chat]);

  useEffect(() => {
    const removeChunk = window.promethee.agent.onChunk(({ chatId, delta }: { chatId: string; delta: string }) => {
      if (chatId === chatIdRef.current) {
        streamingContentRef.current += delta;
        setStreamingContent(streamingContentRef.current);
      }
    });
    const removeEnd = window.promethee.agent.onStreamEnd(({ chatId, message }: { chatId: string; message: Message }) => {
      if (chatId === chatIdRef.current) {
        setMessages(prev => [...prev, message]);
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
      }
    });
    const removeError = window.promethee.agent.onStreamError(({ chatId, error: err }: { chatId: string; error: string }) => {
      if (chatId === chatIdRef.current) {
        setError(friendlyAiError(err));
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
      }
    });
    return () => { removeChunk(); removeEnd(); removeError(); };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedImages(prev =>
      [...prev, ...files.map(file => ({ objectUrl: URL.createObjectURL(file), file }))].slice(0, 4)
    );
    e.target.value = '';
  };

  const removeImage = (i: number) => {
    setAttachedImages(prev => {
      URL.revokeObjectURL(prev[i].objectUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const clearScreenSnap = () => {
    void window.promethee.window.clearPendingScreenCapture();
    setScreenSnapQueued(false);
    setScreenCaptureError(null);
  };

  const toggleLiveScreen = () => {
    const next = !liveScreenEveryMessage;
    setLiveScreenEveryMessage(next);
    setMentorLiveScreenEveryMessage(next);
    if (next) clearScreenSnap();
  };

  const handleScreenSnap = async () => {
    if (!chat || streaming || liveScreenEveryMessage) return;
    if (screenSnapQueued) {
      clearScreenSnap();
      return;
    }
    setScreenCaptureError(null);
    setCapturingScreen(true);
    const r = await window.promethee.window.captureScreen();
    setCapturingScreen(false);
    if (r.success) setScreenSnapQueued(true);
    else setScreenCaptureError(r.error || 'Could not capture screen.');
  };

  const handleSend = async () => {
    if (!input.trim() || streaming || !chat) return;
    const content = input.trim();
    const imagesToSend = [...attachedImages];
    setStreaming(true);
    setScreenCaptureError(null);
    setError(null);

    if (liveScreenEveryMessage) {
      const cap = await window.promethee.window.captureScreen();
      if (!cap.success) {
        setScreenCaptureError(cap.error || 'Could not capture screen.');
        setStreaming(false);
        return;
      }
    }

    setInput('');
    setAttachedImages([]);
    setScreenSnapQueued(false);
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now() }]);
    const base64Images =
      imagesToSend.length > 0
        ? await Promise.all(imagesToSend.map((img) => fileToBase64(img.file)))
        : [];
    imagesToSend.forEach((img) => URL.revokeObjectURL(img.objectUrl));
    await window.promethee.agent.sendMessageWithImages(chat.id, content, base64Images, messages);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleOpenHistory = async () => {
    const result = await window.promethee.agent.getChats();
    if (result.success) setAllChats(result.chats || []);
    setShowHistory(true);
  };

  const handleSelectChat = async (chatId: string) => {
    const msgResult = await window.promethee.agent.getMessages(chatId);
    const chatObj = allChats.find(c => c.id === chatId);
    if (chatObj) setChat({ id: chatObj.id, title: chatObj.title, systemPrompt: '' });
    setMessages(msgResult.success ? (msgResult.messages || []) : []);
    setShowHistory(false);
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartY.current = e.clientY;
    resizeStartW.current = panelSizeRef.current.w;
    resizeStartH.current = panelSizeRef.current.h;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    overlaySuppressHitTest(1);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    // Panel is on the right side; dragging left = wider, up = taller
    const dw = resizeStartX.current - e.clientX;
    const dh = resizeStartY.current - e.clientY;
    setPanelSize({
      w: Math.max(MIN_W, Math.min(MAX_W, resizeStartW.current + dw)),
      h: Math.max(MIN_H, Math.min(MAX_H, resizeStartH.current + dh)),
    });
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    isResizing.current = false;
    overlaySuppressHitTest(-1);
    overlayRestoreClickThrough();
    try { localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(panelSizeRef.current)); } catch {}
  };

  const handleBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    isDragging.current = true;
    didMove.current = false;
    setIsDraggingState(true);
    dragStartClientY.current = e.clientY;
    dragStartBottomY.current = bottomYRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    overlaySuppressHitTest(1);
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current) return;
    const dy = e.clientY - dragStartClientY.current;
    if (Math.abs(dy) > 12) didMove.current = true;
    setBottomY(clampBottomY(dragStartBottomY.current - dy));
  };

  const finishDrag = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsDraggingState(false);
    localStorage.setItem(STORAGE_KEY, String(bottomYRef.current));
    overlaySuppressHitTest(-1);
    overlayRestoreClickThrough();
  }, []);

  const handleBubblePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const moved = didMove.current;
    finishDrag();
    if (!moved) setOpen(o => !o);
  };

  useEffect(() => {
    window.addEventListener('pointerup', finishDrag);
    return () => window.removeEventListener('pointerup', finishDrag);
  }, [finishDrag]);

  const openUpward = bottomY < window.innerHeight / 2;

  return (
    <div className="agent-bubble-root promethee-mouse-target" style={{ right: RIGHT_MARGIN, bottom: bottomY }}>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`agent-panel agent-panel--${openUpward ? 'up' : 'down'}`}
            style={{ width: panelSize.w, height: panelSize.h }}
            initial={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="agent-panel-header">
              <div className="agent-panel-title-group">
                {activeSession?.task && (
                  <span className="agent-panel-label">Session</span>
                )}
                <span className="agent-panel-title">
                  {activeSession?.task ?? 'Promethee AI'}
                </span>
              </div>
              <div className="agent-panel-header-actions">
                <button className="agent-panel-history" onClick={showHistory ? () => setShowHistory(false) : handleOpenHistory} title="Chat history">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <button className="agent-panel-close" onClick={() => setOpen(false)}>×</button>
              </div>
            </div>

            {showHistory ? (
              <div className="agent-history">
                <div className="agent-history-header">
                  <span className="agent-history-title">Previous chats</span>
                </div>
                {allChats.length === 0 ? (
                  <div className="agent-empty">No previous chats.</div>
                ) : (
                  <div className="agent-history-list">
                    {allChats.map(c => (
                      <button key={c.id} className="agent-history-item" onClick={() => handleSelectChat(c.id)}>
                        <span className="agent-history-item-title">{c.title || 'Untitled'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="agent-messages">
                  {messages.length === 0 && !streaming && (
                    <div className="agent-empty">Ask anything. I know what you're working on.</div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`agent-message agent-message--${msg.role}`}>
                      {msg.role === 'assistant' ? (
                        <div className="agent-message-content agent-message-content--md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="agent-message-content">{msg.content}</span>
                      )}
                      {msg.role === 'assistant' && (
                        <button
                          className={`agent-message-copy${copiedId === msg.id ? ' agent-message-copy--copied' : ''}`}
                          onClick={() => handleCopy(msg.id, msg.content)}
                        >
                          {copiedId === msg.id ? '✓ Copied' : (
                            <>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                  {streaming && !streamingContent && (
                    <div className="agent-message agent-message--assistant">
                      <div className="agent-typing-bubble" aria-label="Assistant is typing">
                        <span className="agent-typing-dot" />
                        <span className="agent-typing-dot" />
                        <span className="agent-typing-dot" />
                      </div>
                    </div>
                  )}
                  {streaming && streamingContent && (
                    <div className="agent-message agent-message--assistant agent-message--streaming">
                      <div className="agent-message-content agent-message-content--md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                        <span className="agent-cursor" />
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="agent-error">
                      {error}
                      <button onClick={() => setError(null)}>Dismiss</button>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {attachedImages.length > 0 && (
                  <div className="agent-image-strip">
                    {attachedImages.map((img, i) => (
                      <div key={i} className="agent-image-thumb">
                        <img src={img.objectUrl} alt="" />
                        <button className="agent-image-remove" onClick={() => removeImage(i)}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                {screenCaptureError && (
                  <div className="agent-screen-chip agent-screen-chip--error" role="alert">
                    <span className="agent-screen-chip-text">{screenCaptureError}</span>
                    <button type="button" className="agent-screen-chip-remove" aria-label="Dismiss" onClick={() => setScreenCaptureError(null)}>
                      <X size={13} strokeWidth={2} />
                    </button>
                  </div>
                )}
                {screenSnapQueued && !screenCaptureError && !liveScreenEveryMessage && (
                  <div className="agent-screen-chip" title="Your desktop (without Promethee covering it) is sent with the next message.">
                    <Monitor size={12} />
                    <span className="agent-screen-chip-text">Screen · next send</span>
                    <button type="button" className="agent-screen-chip-remove" aria-label="Remove snapshot" onClick={clearScreenSnap}>
                      <X size={13} strokeWidth={2} />
                    </button>
                  </div>
                )}

                <div className="agent-live-screen-bar">
                  <span className="agent-live-screen-bar-label">Screen on every send</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={liveScreenEveryMessage}
                    className="agent-live-screen-switch"
                    onClick={toggleLiveScreen}
                    disabled={streaming}
                    title={liveScreenEveryMessage ? 'Turn off — use monitor for one send only' : 'Capture desktop before each message'}
                  >
                    <span className="agent-live-screen-switch-thumb" aria-hidden />
                  </button>
                </div>

                <div className="agent-input-row agent-input-row--align-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button className="agent-attach" onClick={() => fileInputRef.current?.click()} disabled={streaming} title="Attach image">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`agent-screen-snap${screenSnapQueued ? ' agent-screen-snap--active' : ''}`}
                    onClick={handleScreenSnap}
                    disabled={streaming || capturingScreen || liveScreenEveryMessage}
                    title={
                      liveScreenEveryMessage
                        ? 'Turn off "every send" to queue one capture'
                        : screenSnapQueued
                          ? 'Remove queued desktop'
                          : capturingScreen
                            ? 'Capturing…'
                            : 'Include desktop on next message (overlay stays visible)'
                    }
                  >
                    <Monitor size={14} />
                  </button>
                  <textarea
                    ref={inputRef}
                    className="agent-input"
                    placeholder="Ask anything..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={streaming}
                  />
                  <button className="agent-send" onClick={handleSend} disabled={!input.trim() || streaming} title="Send (Enter)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M1 7L13 1L7 13L6 8L1 7Z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </>
            )}
            {/* Resize handle — top-left corner of panel (panel is right-anchored) */}
            <div
              className="agent-panel-resize-handle"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              title="Drag to resize"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        className={`agent-bubble ${open ? 'agent-bubble--open' : ''} ${isDraggingState ? 'agent-bubble--dragging' : ''}`}
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        title="Mentor AI — drag to reposition"
      >
        <span className="agent-bubble-label">Mentor AI</span>
      </button>
    </div>
  );
}

export default AgentBubble;
