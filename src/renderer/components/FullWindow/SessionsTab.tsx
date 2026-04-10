import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, Circle, StickyNote, MessageCircle, Zap, Clock, Plus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatView, type Chat } from './ChatView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  task?: string;
  started_at: number;
  duration_seconds?: number;
  xp_earned?: number;
}

interface Task {
  id: string;
  session_id: string | null;
  text: string;
  completed: number;
  position: number;
  xp_reward?: number | null;
  created_at: number;
}

interface Note {
  id: string;
  session_id: string;
  text: string;
  created_at: number;
}

type Nav =
  | { view: 'list' }
  | { view: 'detail'; session: Session }
  | { view: 'chat'; chat: Chat; prev: { view: 'list' } | { view: 'detail'; session: Session } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function groupByDay<T>(items: T[], getTs: (i: T) => number): { label: string; items: T[] }[] {
  const map = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const label = dayLabel(getTs(item));
    if (!map.has(label)) map.set(label, { label, items: [] });
    map.get(label)!.items.push(item);
  }
  return Array.from(map.values());
}

function formatDuration(s?: number) {
  if (!s) return null;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function toNoteMarkdown(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '  \n');
}

// ─── Count badges ─────────────────────────────────────────────────────────────

function CountBadge({ icon, count }: { icon: React.ReactNode; count: number }) {
  if (!count) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 6px' }}>
      {icon}
      {count}
    </span>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 18 } },
};

interface ListViewProps {
  sessions: Session[];
  tasksBySession: Map<string, Task[]>;
  notesBySession: Map<string, Note[]>;
  chatsBySession: Map<string, Chat[]>;
  orphanChats: Chat[];
  onSelectSession: (s: Session) => void;
  onSelectChat: (c: Chat) => void;
  loading: boolean;
}

function ListView({ sessions, tasksBySession, notesBySession, chatsBySession, orphanChats, onSelectSession, onSelectChat, loading }: ListViewProps) {
  const groups = groupByDay(sessions, s => s.started_at);

  if (loading) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
    );
  }

  const isEmpty = sessions.length === 0 && orphanChats.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '40px', gap: 32, height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--foreground)', margin: 0 }}>Sessions</h2>

      {isEmpty && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          No sessions yet. Start a focus session from the overlay to begin.
        </p>
      )}

      {/* Orphan (non-session) chats */}
      {orphanChats.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, padding: '0 4px 2px' }}>
            Conversations
          </div>
          {orphanChats.map(chat => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat(chat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
            >
              <MessageCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chat.title}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatTime(chat.created_at)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sessions grouped by day */}
      {!isEmpty && (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} initial="hidden" animate="visible" variants={listVariants}>
          {groups.map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <motion.div variants={rowVariants} style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, padding: '0 4px 4px' }}>
                {group.label}
              </motion.div>
              {group.items.map(s => {
                const taskCount = tasksBySession.get(s.id)?.length ?? 0;
                const noteCount = notesBySession.get(s.id)?.length ?? 0;
                const chatCount = chatsBySession.get(s.id)?.length ?? 0;
                const dur = formatDuration(s.duration_seconds);
                return (
                  <motion.button
                    key={s.id}
                    variants={rowVariants}
                    type="button"
                    onClick={() => onSelectSession(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
                      cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s', width: '100%',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 400 }}>
                      {s.task || 'Focus session'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {dur && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                          <Clock size={11} /> {dur}
                        </span>
                      )}
                      {(s.xp_earned ?? 0) > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--accent-fire)', fontWeight: 600 }}>
                          <Zap size={11} /> {s.xp_earned}
                        </span>
                      )}
                      <CountBadge icon={<StickyNote size={10} />} count={noteCount} />
                      <CountBadge icon={<Check size={10} />} count={taskCount} />
                      <CountBadge icon={<MessageCircle size={10} />} count={chatCount} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{formatTime(s.started_at)}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

interface DetailViewProps {
  session: Session;
  tasks: Task[];
  notes: Note[];
  chats: Chat[];
  onBack: () => void;
  onSelectChat: (c: Chat) => void;
  onToggleTask: (taskId: string) => Promise<void>;
}

function DetailView({ session, tasks, notes, chats, onBack, onSelectChat, onToggleTask }: DetailViewProps) {
  const dur = formatDuration(session.duration_seconds);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          type="button" onClick={onBack}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.task || 'Focus session'}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(session.started_at)}</span>
            {dur && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {dur}</span>}
            {(session.xp_earned ?? 0) > 0 && (
              <span style={{ fontSize: 11, color: 'var(--accent-fire)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><Zap size={10} /> {session.xp_earned} XP</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Tasks */}
        {tasks.length > 0 && (
          <Section label="Tasks" icon={<Check size={13} />}>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tasks.map(task => {
                const done = Boolean(task.completed);
                return (
                  <li
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={done}
                    onClick={() => onToggleTask(task.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleTask(task.id); } }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ flexShrink: 0, marginTop: 2, color: done ? 'var(--accent-fire)' : 'var(--text-muted)' }}>
                      {done ? <Check size={15} strokeWidth={2.5} /> : <Circle size={15} strokeWidth={1.5} />}
                    </span>
                    <span style={{ fontSize: 13, flex: 1, color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1, wordBreak: 'break-word' }}>
                      {task.text}
                    </span>
                    {task.xp_reward ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-fire)', flexShrink: 0 }}>+{task.xp_reward} XP</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <Section label="Notes" icon={<StickyNote size={13} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes.map(note => (
                <div key={note.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                  <div className="prose prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-0 [&_p+*]:mt-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{toNoteMarkdown(note.text)}</ReactMarkdown>
                  </div>
                  <div style={{ marginTop: 6, textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.5 }}>{formatTime(note.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Chats */}
        {chats.length > 0 && (
          <Section label="Mentor chats" icon={<MessageCircle size={13} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {chats.map(chat => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelectChat(chat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s', width: '100%',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
                >
                  <MessageCircle size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.title}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatTime(chat.created_at)}</span>
                  <ArrowLeft size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: 'rotate(180deg)' }} />
                </button>
              ))}
            </div>
          </Section>
        )}

        {tasks.length === 0 && notes.length === 0 && chats.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
            No tasks, notes or chats recorded for this session.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Main SessionsTab ─────────────────────────────────────────────────────────

export default function SessionsTab() {
  const [nav, setNav] = useState<Nav>({ view: 'list' });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sessRes, taskRes, noteRes, chatRes] = await Promise.all([
      window.promethee.db.getSessions(),
      window.promethee.tasks.listAll(),
      window.promethee.notes.listAll(),
      window.promethee.agent.getChats(),
    ]);
    if (sessRes.success) setSessions((sessRes.sessions || []) as Session[]);
    if (taskRes.success) setTasks((taskRes.tasks || []) as Task[]);
    if (noteRes.success) setNotes((noteRes.notes || []) as Note[]);
    if (chatRes.success) setChats((chatRes.chats || []).sort((a: Chat, b: Chat) => b.created_at - a.created_at));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build lookup maps
  const tasksBySession = new Map<string, Task[]>();
  const notesBySession = new Map<string, Note[]>();
  const chatsBySession = new Map<string, Chat[]>();

  for (const t of tasks) {
    if (!t.session_id) continue;
    if (!tasksBySession.has(t.session_id)) tasksBySession.set(t.session_id, []);
    tasksBySession.get(t.session_id)!.push(t);
  }
  for (const arr of tasksBySession.values()) arr.sort((a, b) => a.position - b.position || a.created_at - b.created_at);

  for (const n of notes) {
    if (!notesBySession.has(n.session_id)) notesBySession.set(n.session_id, []);
    notesBySession.get(n.session_id)!.push(n);
  }
  for (const arr of notesBySession.values()) arr.sort((a, b) => a.created_at - b.created_at);

  for (const c of chats) {
    if (!c.session_id) continue;
    if (!chatsBySession.has(c.session_id)) chatsBySession.set(c.session_id, []);
    chatsBySession.get(c.session_id)!.push(c);
  }

  const orphanChats = chats.filter(c => !c.session_id);

  const onToggleTask = async (taskId: string) => {
    await window.promethee.tasks.toggle(taskId);
    await load();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', background: 'var(--background)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait">
        {nav.view === 'list' && (
          <motion.div key="list" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}>
            <ListView
              sessions={sessions}
              tasksBySession={tasksBySession}
              notesBySession={notesBySession}
              chatsBySession={chatsBySession}
              orphanChats={orphanChats}
              loading={loading}
              onSelectSession={s => setNav({ view: 'detail', session: s })}
              onSelectChat={c => setNav({ view: 'chat', chat: c, prev: { view: 'list' } })}
            />
          </motion.div>
        )}

        {nav.view === 'detail' && (
          <motion.div key={`detail-${nav.session.id}`} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18 }}>
            <DetailView
              session={nav.session}
              tasks={tasksBySession.get(nav.session.id) ?? []}
              notes={notesBySession.get(nav.session.id) ?? []}
              chats={chatsBySession.get(nav.session.id) ?? []}
              onBack={() => setNav({ view: 'list' })}
              onSelectChat={c => setNav({ view: 'chat', chat: c, prev: nav })}
              onToggleTask={onToggleTask}
            />
          </motion.div>
        )}

        {nav.view === 'chat' && (
          <motion.div key={`chat-${nav.chat.id}`} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18 }}>
            <ChatView
              chat={nav.chat}
              onBack={() => setNav(nav.prev)}
              backLabel={nav.prev.view === 'detail' ? (nav.prev.session.task || 'Session') : 'Sessions'}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
