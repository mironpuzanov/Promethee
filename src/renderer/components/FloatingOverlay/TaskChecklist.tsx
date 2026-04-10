import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Check, ChevronDown, Circle, FileText, ListChecks, StickyNote, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { overlaySuppressHitTest, overlayRestoreClickThrough } from '../../lib/overlayMouseBridge';
import './TaskChecklist.css';

interface Session {
  id: string;
  task?: string;
  startedAt: number;
}

interface DbTask {
  id: string;
  session_id: string | null;
  text: string;
  completed: number;
  position: number;
  xp_reward?: number | null;
}

interface DbNote {
  id: string;
  session_id: string;
  text: string;
  created_at: number;
}

interface TaskChecklistProps {
  session: Session;
  /** Increment (e.g. global shortcut) to expand panel and focus the add-task input */
  focusAddFieldTrigger?: number;
  /** Increment to toggle the panel open/closed from a shortcut. */
  togglePanelTrigger?: number;
}

const LEFT_MARGIN = 24;
const TOP_MARGIN = 16;
const PILL_H = 32;
const STORAGE_KEY = 'taskChecklistTopY';
const EXPANDED_RESERVE = 360;
const PANEL_SIZE_KEY = 'taskChecklistPanelSize';
const TC_MIN_W = 220;
const TC_MAX_W = 520;
const TC_MIN_H = 180;
const TC_MAX_H = 700;

function loadPanelSize(): { w: number; h: number } {
  try {
    const s = localStorage.getItem(PANEL_SIZE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { w: 280, h: 360 };
}

function loadTopY(): number {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s !== null) return Number(s);
  } catch { /* ignore */ }
  return TOP_MARGIN;
}

function clampTopY(y: number, collapsed: boolean): number {
  const reserve = collapsed ? PILL_H + 8 : EXPANDED_RESERVE;
  const max = window.innerHeight - TOP_MARGIN - reserve;
  return Math.max(TOP_MARGIN, Math.min(max, y));
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function toNoteMarkdown(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '  \n');
}

function TaskChecklist({ session, focusAddFieldTrigger = 0, togglePanelTrigger = 0 }: TaskChecklistProps) {
  const [tab, setTab] = useState<'tasks' | 'notes'>('tasks');
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [collapsed, setCollapsed] = useState(true);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [topY, setTopY] = useState(loadTopY);
  const [panelSize, setPanelSize] = useState(loadPanelSize);
  const topYRef = useRef(topY);
  const panelSizeRef = useRef(panelSize);
  const addInputRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const didMove = useRef(false);
  const dragStartY = useRef(0);
  const dragStartTop = useRef(0);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartW = useRef(0);
  const resizeStartH = useRef(0);

  useEffect(() => { topYRef.current = topY; }, [topY]);
  useEffect(() => { panelSizeRef.current = panelSize; }, [panelSize]);

  const loadTasks = useCallback(async () => {
    // Load session tasks + general (standalone) tasks together
    const [sessionRes, allRes] = await Promise.all([
      window.promethee.tasks.list(session.id),
      window.promethee.tasks.listAll(),
    ]);
    const sessionTasks = sessionRes.success ? (sessionRes.tasks || []) as DbTask[] : [];
    const standaloneTasks = allRes.success
      ? ((allRes.tasks || []) as DbTask[]).filter((t) => !t.session_id)
      : [];
    setTasks([...sessionTasks, ...standaloneTasks]);
  }, [session.id]);

  const loadNotes = useCallback(async () => {
    const r = await window.promethee.notes.list(session.id);
    if (r.success) setNotes((r.notes || []) as DbNote[]);
  }, [session.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  // New session → reset to top-right, collapsed, tasks tab
  useEffect(() => {
    setCollapsed(true);
    setTab('tasks');
    setDraft('');
    const y = clampTopY(TOP_MARGIN, true);
    setTopY(y);
    topYRef.current = y;
  }, [session.id]);

  useEffect(() => {
    const onResize = () => setTopY(y => clampTopY(y, collapsed));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [collapsed]);

  const onToggleTask = async (taskId: string) => {
    const r = await window.promethee.tasks.toggle(taskId);
    if (r.success) await loadTasks();
  };

  const onDeleteTask = async (taskId: string) => {
    const r = await window.promethee.tasks.delete(taskId);
    if (r.success) await loadTasks();
  };

  const onDeleteNote = async (noteId: string) => {
    const r = await window.promethee.notes.delete(noteId);
    if (r.success) await loadNotes();
  };

  const onAdd = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    const t = draft.trim();
    if (!t || adding) return;
    setAdding(true);
    if (tab === 'tasks') {
      const r = await window.promethee.tasks.add(session.id, t);
      setAdding(false);
      if (r.success) { setDraft(''); await loadTasks(); }
    } else {
      const r = await window.promethee.notes.add(session.id, t);
      setAdding(false);
      if (r.success) { setDraft(''); await loadNotes(); }
    }
  };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartY.current = e.clientY;
    resizeStartW.current = panelSizeRef.current.w;
    resizeStartH.current = panelSizeRef.current.h;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    overlaySuppressHitTest(1);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    // Panel anchored to left — dragging right makes it wider
    const dw = e.clientX - resizeStartX.current;
    const dh = e.clientY - resizeStartY.current;
    setPanelSize({
      w: Math.max(TC_MIN_W, Math.min(TC_MAX_W, resizeStartW.current + dw)),
      h: Math.max(TC_MIN_H, Math.min(TC_MAX_H, resizeStartH.current + dh)),
    });
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    isResizing.current = false;
    overlaySuppressHitTest(-1);
    overlayRestoreClickThrough();
    try { localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(panelSizeRef.current)); } catch {}
  };

  const persistTop = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, String(topYRef.current)); } catch { /* ignore */ }
  }, []);

  const finishDrag = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    persistTop();
    overlaySuppressHitTest(-1);
    overlayRestoreClickThrough();
  }, [persistTop]);

  useEffect(() => {
    window.addEventListener('pointerup', finishDrag);
    return () => window.removeEventListener('pointerup', finishDrag);
  }, [finishDrag]);

  const onDragHandlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    didMove.current = false;
    dragStartY.current = e.clientY;
    dragStartTop.current = topYRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    overlaySuppressHitTest(1);
  };

  const onDragHandlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dy = e.clientY - dragStartY.current;
    if (Math.abs(dy) > 4) didMove.current = true;
    setTopY(clampTopY(dragStartTop.current + dy, collapsed));
  };

  const onPillPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const moved = didMove.current;
    finishDrag();
    if (!moved) setCollapsed(false);
  };

  const onHeaderPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const moved = didMove.current;
    finishDrag();
    if (!moved) setCollapsed(true);
  };

  useEffect(() => {
    setTopY(y => clampTopY(y, collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (focusAddFieldTrigger <= 0) return;
    setCollapsed(false);
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) addInputRef.current?.focus();
      });
    });
    return () => { cancelled = true; };
  }, [focusAddFieldTrigger]);

  useEffect(() => {
    if (togglePanelTrigger <= 0) return;
    setCollapsed((prev) => {
      const next = !prev;
      if (!next) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => addInputRef.current?.focus());
        });
      }
      return next;
    });
  }, [togglePanelTrigger]);

  // Clear draft when switching tabs
  useEffect(() => { setDraft(''); }, [tab]);

  // Reset textarea height when draft is cleared
  useLayoutEffect(() => {
    if (draft === '' && addInputRef.current) {
      addInputRef.current.style.height = '';
    }
  }, [draft]);

  const incompleteTasks = tasks.filter(t => !t.completed);
  const totalCount = incompleteTasks.length + notes.length;

  return (
    <div
      className="task-checklist-root promethee-mouse-target"
      style={{ left: LEFT_MARGIN, top: topY }}
    >
      {collapsed ? (
        <button
          type="button"
          className="task-checklist-pill"
          aria-expanded={false}
          aria-label={`Tasks & notes, ${totalCount} items. Click to expand, drag to move.`}
          onPointerDown={onDragHandlePointerDown}
          onPointerMove={onDragHandlePointerMove}
          onPointerUp={onPillPointerUp}
        >
          <ListChecks size={16} strokeWidth={2} className="task-checklist-pill__icon" aria-hidden />
          <span className="task-checklist-pill__label">Focus</span>
          {totalCount > 0 && <span className="task-checklist-pill__count">{totalCount}</span>}
        </button>
      ) : (
        <div className="task-checklist-panel" style={{ width: panelSize.w, height: panelSize.h }}>
          {/* Drag handle / collapse header */}
          <div
            className="task-checklist__header task-checklist__header--draggable"
            role="button"
            tabIndex={0}
            aria-expanded
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(true); } }}
            onPointerDown={onDragHandlePointerDown}
            onPointerMove={onDragHandlePointerMove}
            onPointerUp={onHeaderPointerUp}
          >
            <span className="task-checklist__title">Focus</span>
            <ChevronDown size={16} className="task-checklist__chevron task-checklist__chevron--open" aria-hidden />
          </div>

          {/* Tab switcher */}
          <div className="task-checklist__tabs">
            <button
              type="button"
              className={`task-checklist__tab${tab === 'tasks' ? ' task-checklist__tab--active' : ''}`}
              onClick={() => setTab('tasks')}
            >
              <ListChecks size={13} aria-hidden />
              Tasks
              {incompleteTasks.length > 0 && <span className="task-checklist__tab-count">{incompleteTasks.length}</span>}
            </button>
            <button
              type="button"
              className={`task-checklist__tab${tab === 'notes' ? ' task-checklist__tab--active' : ''}`}
              onClick={() => setTab('notes')}
            >
              <StickyNote size={13} aria-hidden />
              Notes
              {notes.length > 0 && <span className="task-checklist__tab-count">{notes.length}</span>}
            </button>
          </div>

          {/* Tasks list */}
          {tab === 'tasks' && (
            <div className="task-checklist__list">
              {incompleteTasks.length === 0 && (
                <p className="task-checklist__empty">No tasks yet</p>
              )}
              {incompleteTasks.map((task) => {
                const done = Boolean(task.completed);
                return (
                  <div
                    key={task.id}
                    className="task-checklist__row"
                    tabIndex={0}
                    aria-label={`${done ? 'Completed' : 'Open'}: ${task.text}. Press Enter to toggle.`}
                    aria-checked={done}
                    role="checkbox"
                    onClick={() => onToggleTask(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleTask(task.id); }
                    }}
                  >
                    <span className="task-checklist__check" aria-hidden>
                      {done ? <Check size={16} strokeWidth={2.5} /> : <Circle size={16} strokeWidth={2} />}
                    </span>
                    <span className={`task-checklist__text${done ? ' task-checklist__text--done' : ''}`}>
                      {task.text}
                    </span>
                    {task.xp_reward ? (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', flexShrink: 0 }}>
                        +{task.xp_reward} XP
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="task-checklist__delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                      aria-label="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes list */}
          {tab === 'notes' && (
            <div className="task-checklist__list">
              {notes.length === 0 && (
                <p className="task-checklist__empty">Capture thoughts as they come</p>
              )}
              {notes.map((note) => (
                <div key={note.id} className="task-checklist__row task-checklist__row--note">
                  <div className="task-checklist__note-body">
                    <div className="task-checklist__text task-checklist__text--note task-checklist__markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {toNoteMarkdown(note.text)}
                      </ReactMarkdown>
                    </div>
                    <div className="task-checklist__note-footer">
                      <span className="task-checklist__note-time">{formatTime(note.created_at)}</span>
                      <button
                        type="button"
                        className="task-checklist__delete"
                        onClick={() => onDeleteNote(note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={addInputRef as React.RefObject<HTMLTextAreaElement>}
            className="task-checklist__input"
            value={draft}
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.currentTarget;
              el.style.height = '0px';
              el.style.height = `${Math.max(34, Math.min(el.scrollHeight, 120))}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onAdd();
              }
            }}
            placeholder={tab === 'tasks' ? 'Add a task… (↵ to save)' : 'Quick note… (↵ to save)'}
            maxLength={1000}
          />
          {/* Resize handle — bottom-right corner */}
          <div
            className="task-checklist__resize-handle"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            title="Drag to resize"
          />
        </div>
      )}
    </div>
  );
}

export default TaskChecklist;
