import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, StickyNote } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SessionRow {
  id: string;
  task?: string;
  started_at: number;
}

interface DbTask {
  id: string;
  session_id: string;
  text: string;
  completed: number;
  position: number;
  created_at: number;
}

interface DbNote {
  id: string;
  session_id: string;
  text: string;
  created_at: number;
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function groupByDay<T>(items: T[], getTs: (item: T) => number): { label: string; items: T[] }[] {
  const map = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const label = dayLabel(getTs(item));
    if (!map.has(label)) map.set(label, { label, items: [] });
    map.get(label)!.items.push(item);
  }
  return Array.from(map.values());
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 18 } },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function toNoteMarkdown(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '  \n');
}

export default function TasksTab() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sessRes, taskRes, noteRes] = await Promise.all([
      window.promethee.db.getSessions(),
      window.promethee.tasks.listAll(),
      window.promethee.notes.listAll(),
    ]);
    if (sessRes.success) setSessions((sessRes.sessions || []) as SessionRow[]);
    if (taskRes.success) setTasks((taskRes.tasks || []) as DbTask[]);
    if (noteRes.success) setNotes((noteRes.notes || []) as DbNote[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const taskBySession = new Map<string, DbTask[]>();
  for (const t of tasks) {
    if (!taskBySession.has(t.session_id)) taskBySession.set(t.session_id, []);
    taskBySession.get(t.session_id)!.push(t);
  }
  for (const arr of taskBySession.values()) {
    arr.sort((a, b) => a.position - b.position || a.created_at - b.created_at);
  }

  const noteBySession = new Map<string, DbNote[]>();
  for (const n of notes) {
    if (!noteBySession.has(n.session_id)) noteBySession.set(n.session_id, []);
    noteBySession.get(n.session_id)!.push(n);
  }
  for (const arr of noteBySession.values()) {
    arr.sort((a, b) => a.created_at - b.created_at);
  }

  const sessionsWithContent = sessions.filter(
    (s) => taskBySession.has(s.id) || noteBySession.has(s.id)
  );
  const dayGroups = groupByDay(sessionsWithContent, (s) => s.started_at);

  const onToggle = async (taskId: string) => {
    const r = await window.promethee.tasks.toggle(taskId);
    if (r.success) await load();
  };

  if (loading) {
    return (
      <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6">
        <h2 className="text-2xl font-light text-foreground">Focus Log</h2>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6">
      <h2 className="text-2xl font-light text-foreground">Focus Log</h2>
      {sessionsWithContent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tasks and notes from your focus sessions will appear here.
        </p>
      ) : (
        <motion.div
          className="flex flex-col gap-8"
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          {dayGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-4">
              <motion.div
                variants={rowVariants}
                className="text-xs text-muted-foreground font-medium tracking-wide uppercase px-1"
              >
                {group.label}
              </motion.div>
              {group.items.map((sess) => {
                const sessionTasks = taskBySession.get(sess.id) || [];
                const sessionNotes = noteBySession.get(sess.id) || [];
                return (
                  <motion.div
                    key={sess.id}
                    variants={rowVariants}
                    className="flex flex-col gap-2 rounded-xl bg-card border border-border/60 overflow-hidden"
                  >
                    <div className="px-4 pt-3 pb-1">
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Session
                      </div>
                      <div className="text-sm text-foreground font-medium truncate">
                        {sess.task || 'Untitled session'}
                      </div>
                    </div>

                    {sessionTasks.length > 0 && (
                      <ul className="px-2 pb-1 flex flex-col gap-0.5">
                        {sessionTasks.map((task) => {
                          const done = Boolean(task.completed);
                          return (
                            <li
                              key={task.id}
                              role="button"
                              tabIndex={0}
                              aria-pressed={done}
                              aria-label={`${done ? 'Completed' : 'Open'}: ${task.text}`}
                              onClick={() => onToggle(task.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onToggle(task.id);
                                }
                              }}
                              className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer text-left w-full"
                            >
                              <span className="flex-shrink-0 mt-0.5 text-muted-foreground pointer-events-none" aria-hidden>
                                {done ? <Check size={16} strokeWidth={2.5} /> : <Circle size={16} strokeWidth={2} />}
                              </span>
                              <span
                                className={`text-sm flex-1 pointer-events-none ${done ? 'line-through opacity-40 text-muted-foreground' : 'text-foreground'}`}
                              >
                                {task.text}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {sessionNotes.length > 0 && (
                      <>
                        {sessionTasks.length > 0 && (
                          <div className="mx-4 border-t border-border/40" />
                        )}
                        <ul className="px-2 pb-3 flex flex-col gap-0.5">
                          {sessionNotes.map((note) => (
                            <li
                              key={note.id}
                              className="flex items-start gap-2 px-2 py-1.5 text-left"
                            >
                              <span className="flex-shrink-0 mt-0.5 text-muted-foreground/50 pointer-events-none" aria-hidden>
                                <StickyNote size={14} strokeWidth={1.5} />
                              </span>
                              <div className="flex-1 min-w-0 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                                <div className="prose prose-invert max-w-none text-sm text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-0 [&_p+*]:mt-2 [&_ul]:my-0 [&_ol]:my-0 [&_pre]:my-0 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/25 [&_pre]:p-3 [&_code]:whitespace-pre-wrap">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {toNoteMarkdown(note.text)}
                                  </ReactMarkdown>
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <span className="text-xs text-muted-foreground/40 tabular-nums">
                                    {formatTime(note.created_at)}
                                  </span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {sessionTasks.length === 0 && sessionNotes.length === 0 && (
                      <div className="px-4 pb-3 text-xs text-muted-foreground/50">No items</div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
