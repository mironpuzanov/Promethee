import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronDown, Circle, ListChecks, Trash2 } from 'lucide-react';
import { overlaySuppressHitTest, overlayRestoreClickThrough } from '../../lib/overlayMouseBridge';
import './TaskChecklist.css';

interface Session {
  id: string;
  task?: string;
  startedAt: number;
}

interface DbTask {
  id: string;
  session_id: string;
  text: string;
  completed: number;
  position: number;
}

interface TaskChecklistProps {
  session: Session;
  /** Increment (e.g. global shortcut) to expand panel and focus the add-task input */
  focusAddFieldTrigger?: number;
}

const RIGHT_MARGIN = 24;
/** Align with level pill (`LevelPill.css` top: 16px) — true upper-right band */
const TOP_MARGIN = 16;
const PILL_H = 32;
const STORAGE_KEY = 'taskChecklistTopY';
/** Room so expanded panel + mentor bubble rarely collide */
const EXPANDED_RESERVE = 360;

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

function TaskChecklist({ session, focusAddFieldTrigger = 0 }: TaskChecklistProps) {
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [collapsed, setCollapsed] = useState(true);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [topY, setTopY] = useState(loadTopY);
  const topYRef = useRef(topY);
  const addInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const didMove = useRef(false);
  const dragStartY = useRef(0);
  const dragStartTop = useRef(0);

  useEffect(() => { topYRef.current = topY; }, [topY]);

  const load = useCallback(async () => {
    const r = await window.promethee.tasks.list(session.id);
    if (r.success) setTasks((r.tasks || []) as DbTask[]);
  }, [session.id]);

  useEffect(() => {
    load();
  }, [load]);

  // New session → collapsed pill + anchor top-right (ignore stale drag from previous session)
  useEffect(() => {
    setCollapsed(true);
    const y = clampTopY(TOP_MARGIN, true);
    setTopY(y);
    topYRef.current = y;
  }, [session.id]);

  useEffect(() => {
    const onResize = () => setTopY(y => clampTopY(y, collapsed));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [collapsed]);

  const onToggle = async (taskId: string) => {
    const r = await window.promethee.tasks.toggle(taskId);
    if (r.success) await load();
  };

  const onDelete = async (taskId: string) => {
    const r = await window.promethee.tasks.delete(taskId);
    if (r.success) await load();
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t || adding) return;
    setAdding(true);
    const r = await window.promethee.tasks.add(session.id, t);
    setAdding(false);
    if (r.success) {
      setDraft('');
      await load();
    }
  };

  const persistTop = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(topYRef.current));
    } catch { /* ignore */ }
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
    return () => {
      cancelled = true;
    };
  }, [focusAddFieldTrigger]);

  return (
    <div
      className="task-checklist-root promethee-mouse-target"
      style={{ right: RIGHT_MARGIN, top: topY }}
    >
      {collapsed ? (
        <button
          type="button"
          className="task-checklist-pill"
          aria-expanded={false}
          aria-label={`Tasks, ${tasks.length} items. Click to expand, drag to move.`}
          onPointerDown={onDragHandlePointerDown}
          onPointerMove={onDragHandlePointerMove}
          onPointerUp={onPillPointerUp}
        >
          <ListChecks size={16} strokeWidth={2} className="task-checklist-pill__icon" aria-hidden />
          <span className="task-checklist-pill__label">Tasks</span>
          <span className="task-checklist-pill__count">{tasks.length}</span>
        </button>
      ) : (
        <div className="task-checklist-panel">
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
            <span className="task-checklist__title">Tasks</span>
            <ChevronDown size={16} className="task-checklist__chevron task-checklist__chevron--open" aria-hidden />
          </div>

          <div className="task-checklist__list">
            {tasks.map((task) => {
              const done = Boolean(task.completed);
              return (
                <div
                  key={task.id}
                  className="task-checklist__row"
                  tabIndex={0}
                  aria-label={`${done ? 'Completed' : 'Open'}: ${task.text}. Press Enter to toggle.`}
                  aria-checked={done}
                  role="checkbox"
                  onClick={() => onToggle(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle(task.id);
                    }
                  }}
                >
                  <span className="task-checklist__check" aria-hidden>
                    {done ? <Check size={16} strokeWidth={2.5} /> : <Circle size={16} strokeWidth={2} />}
                  </span>
                  <span
                    className={`task-checklist__text${done ? ' task-checklist__text--done' : ''}`}
                  >
                    {task.text}
                  </span>
                  <button
                    type="button"
                    className="task-checklist__delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    aria-label="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <form onSubmit={onAdd}>
            <input
              ref={addInputRef}
              className="task-checklist__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task… (↵ to save)"
              maxLength={500}
            />
          </form>
        </div>
      )}
    </div>
  );
}

export default TaskChecklist;
