import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

function AgentBubble({ activeSession, openTrigger = 0 }: AgentBubbleProps) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [allChats, setAllChats] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
  const [bottomY, setBottomY] = useState<number>(loadBottomY);
  const [isDraggingState, setIsDraggingState] = useState(false);

  const isDragging = useRef(false);
  const didMove = useRef(false);
  const dragStartClientY = useRef(0);
  const dragStartBottomY = useRef(0);
  const bottomYRef = useRef(bottomY);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomYRef.current = bottomY; }, [bottomY]);

  useEffect(() => {
    if (openTrigger > 0) setOpen(true);
  }, [openTrigger]);

  useEffect(() => {
    return () => { attachedImages.forEach(img => URL.revokeObjectURL(img.objectUrl)); };
  }, []);

  const handleMouseEnter = () => window.promethee.window.setIgnoreMouseEvents(false);
  const handleMouseLeave = () => {
    if (!isDragging.current) window.promethee.window.setIgnoreMouseEvents(true);
  };

  const initChat = useCallback(async () => {
    const tokenResult = await window.promethee.agent.getToken();
    if (!tokenResult.success) { setNeedsApiKey(true); return; }
    const result = await window.promethee.agent.getOrCreateChat(
      activeSession?.task || 'Quick chat',
      activeSession?.id || null,
      buildSystemPrompt(activeSession)
    );
    if (!result.success) { setError('Could not load chat history.'); return; }
    const msgResult = await window.promethee.agent.getMessages(result.chat.id);
    setChat(result.chat);
    setMessages(msgResult.success ? msgResult.messages : []);
  }, [activeSession?.id]);

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    const saved = await window.promethee.agent.setToken(apiKeyInput.trim());
    if (saved.success !== false) {
      setNeedsApiKey(false);
      setApiKeyInput('');
      await initChat();
    } else {
      setError('Failed to save key.');
    }
    setSavingKey(false);
  };

  useEffect(() => { initChat(); }, [initChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (open) {
      window.promethee.window.setFocusable(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      window.promethee.window.setFocusable(false);
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
        setError(err);
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

  const handleSend = async () => {
    if (!input.trim() || streaming || !chat) return;
    const content = input.trim();
    const imagesToSend = [...attachedImages];
    setInput('');
    setAttachedImages([]);
    setError(null);
    setStreaming(true);
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now() }]);
    if (imagesToSend.length > 0) {
      const base64Images = await Promise.all(imagesToSend.map(img => fileToBase64(img.file)));
      imagesToSend.forEach(img => URL.revokeObjectURL(img.objectUrl));
      await window.promethee.agent.sendMessageWithImages(chat.id, content, base64Images, messages);
    } else {
      await window.promethee.agent.sendMessage(chat.id, content, messages);
    }
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
    setMessages(msgResult.success ? msgResult.messages : []);
    setShowHistory(false);
  };

  const handleBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    isDragging.current = true;
    didMove.current = false;
    setIsDraggingState(true);
    dragStartClientY.current = e.clientY;
    dragStartBottomY.current = bottomYRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    window.promethee.window.setIgnoreMouseEvents(false);
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current) return;
    const dy = e.clientY - dragStartClientY.current;
    if (Math.abs(dy) > 4) didMove.current = true;
    setBottomY(clampBottomY(dragStartBottomY.current - dy));
  };

  const finishDrag = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsDraggingState(false);
    localStorage.setItem(STORAGE_KEY, String(bottomYRef.current));
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
    <div
      className="agent-bubble-root"
      style={{ right: RIGHT_MARGIN, bottom: bottomY }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            className={`agent-panel agent-panel--${openUpward ? 'up' : 'down'}`}
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
            ) : needsApiKey ? (
              <div className="agent-setup">
                <p className="agent-setup-label">Add your OpenAI API key to get started.</p>
                <input
                  type="password"
                  className="agent-setup-input"
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
                  autoFocus
                />
                <button className="agent-setup-save" onClick={handleSaveApiKey} disabled={!apiKeyInput.trim() || savingKey}>
                  {savingKey ? 'Saving...' : 'Save key'}
                </button>
              </div>
            ) : (
              <>
                <div className="agent-messages">
                  {messages.length === 0 && !streaming && (
                    <div className="agent-empty">Ask anything. I know what you're working on.</div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`agent-message agent-message--${msg.role}`}>
                      <span className="agent-message-content">{msg.content}</span>
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
                  {streaming && streamingContent && (
                    <div className="agent-message agent-message--assistant agent-message--streaming">
                      <span className="agent-message-content">
                        {streamingContent}<span className="agent-cursor" />
                      </span>
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

                <div className="agent-input-row">
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
                    {streaming ? <span className="agent-send-spinner" /> : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 7L13 1L7 13L6 8L1 7Z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className={`agent-bubble ${open ? 'agent-bubble--open' : ''} ${isDraggingState ? 'agent-bubble--dragging' : ''}`}
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        whileHover={isDraggingState ? {} : { scale: 1.03 }}
        whileTap={isDraggingState ? {} : { scale: 0.97 }}
        title="Mentor AI — drag to reposition"
      >
        <span className="agent-bubble-label">Mentor AI</span>
      </motion.button>
    </div>
  );
}

export default AgentBubble;
