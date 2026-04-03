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

function buildSystemPrompt(session: AgentBubbleProps['activeSession']): string {
  if (!session) {
    return `You are the Promethee AI agent. The user is between focus sessions right now.
Answer concisely. Ask what they're working on if relevant.`;
  }

  const elapsedMinutes = Math.floor((Date.now() - session.startedAt) / 60000);
  const task = session.task || 'Unknown task';

  return `You are the Promethee AI agent. You help users stay focused and get unstuck without leaving their work.

Current session: "${task}" — ${elapsedMinutes} minute${elapsedMinutes !== 1 ? 's' : ''} in.

Answer concisely. You already know what they're working on — don't ask them to re-explain.`;
}

function AgentBubble({ activeSession, openTrigger = 0 }: AgentBubbleProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openTrigger > 0) setOpen(true);
  }, [openTrigger]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef('');

  const handleMouseEnter = () => window.promethee.window.setIgnoreMouseEvents(false);
  const handleMouseLeave = () => window.promethee.window.setIgnoreMouseEvents(true);

  // Initialize or load chat for this session
  const initChat = useCallback(async () => {
    // Check API key first
    const tokenResult = await window.promethee.agent.getToken();
    if (!tokenResult.success) {
      setNeedsApiKey(true);
      return;
    }

    const title = activeSession?.task || 'Quick chat';
    const sessionId = activeSession?.id || null;
    const systemPrompt = buildSystemPrompt(activeSession);

    const result = await window.promethee.agent.getOrCreateChat(title, sessionId, systemPrompt);
    if (!result.success) {
      setError('Could not load chat history.');
      return;
    }

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

  useEffect(() => {
    initChat();
  }, [initChat]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Set up IPC stream listeners
  useEffect(() => {
    const removeChunk = window.promethee.agent.onChunk(({ chatId, delta }: { chatId: string; delta: string }) => {
      if (chat && chatId === chat.id) {
        streamingContentRef.current += delta;
        setStreamingContent(streamingContentRef.current);
      }
    });

    const removeEnd = window.promethee.agent.onStreamEnd(({ chatId, message }: { chatId: string; message: Message }) => {
      if (chat && chatId === chat.id) {
        setMessages(prev => [...prev, message]);
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
      }
    });

    const removeError = window.promethee.agent.onStreamError(({ chatId, error: err }: { chatId: string; error: string }) => {
      if (chat && chatId === chat.id) {
        setError(err);
        setStreamingContent('');
        streamingContentRef.current = '';
        setStreaming(false);
      }
    });

    return () => {
      removeChunk();
      removeEnd();
      removeError();
    };
  }, [chat]);

  const handleSend = async () => {
    if (!input.trim() || streaming || !chat) return;

    const content = input.trim();
    setInput('');
    setError(null);
    setStreaming(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);

    await window.promethee.agent.sendMessage(
      chat.id,
      content,
      messages
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="agent-bubble-root"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            className="agent-panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Header */}
            <div className="agent-panel-header">
              <span className="agent-panel-title">
                {activeSession?.task ? activeSession.task : 'Promethee AI'}
              </span>
              <button
                className="agent-panel-close"
                onClick={() => setOpen(false)}
                title="Close"
              >
                ×
              </button>
            </div>

            {/* API key setup */}
            {needsApiKey && (
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
                <button
                  className="agent-setup-save"
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim() || savingKey}
                >
                  {savingKey ? 'Saving...' : 'Save key'}
                </button>
              </div>
            )}

            {/* Messages */}
            {!needsApiKey && (
            <div className="agent-messages">
              {messages.length === 0 && !streaming && (
                <div className="agent-empty">
                  Ask anything. I know what you're working on.
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`agent-message agent-message--${msg.role}`}>
                  <span className="agent-message-content">{msg.content}</span>
                </div>
              ))}
              {streaming && streamingContent && (
                <div className="agent-message agent-message--assistant agent-message--streaming">
                  <span className="agent-message-content">{streamingContent}</span>
                  <span className="agent-cursor" />
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
            )}

            {/* Input row */}
            {!needsApiKey && (
            <div className="agent-input-row">
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
              <button
                className="agent-send"
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                title="Send (Enter)"
              >
                {streaming ? (
                  <span className="agent-send-spinner" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7L13 1L7 13L6 8L1 7Z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble trigger — text pill */}
      <motion.button
        className={`agent-bubble ${open ? 'agent-bubble--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        title="Ask Promethee AI"
      >
        <span className="agent-bubble-label">Mentor AI</span>
        {activeSession && <span className="agent-bubble-dot" />}
      </motion.button>
    </div>
  );
}

export default AgentBubble;
