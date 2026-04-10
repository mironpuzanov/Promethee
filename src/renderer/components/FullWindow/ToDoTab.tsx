import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';

interface Task {
  id: string;
  session_id: string | null;
  text: string;
  completed: number;
  position: number;
  xp_reward?: number | null;
  created_at: number;
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 18 } },
};

export default function ToDoTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [newXp, setNewXp] = useState('');
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await window.promethee.tasks.listAll();
    if (r.success) {
      const standalone = ((r.tasks || []) as Task[]).filter(t => !t.session_id);
      standalone.sort((a, b) => b.created_at - a.created_at);
      setTasks(standalone);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text || adding) return;
    setAdding(true);
    const r = await (window.promethee.tasks as any).addStandalone(text, newXp ? Number(newXp) : undefined);
    setAdding(false);
    if (r.success) {
      setNewText('');
      setNewXp('');
      await load();
      addInputRef.current?.focus();
    }
  };

  const onToggle = async (taskId: string) => {
    await window.promethee.tasks.toggle(taskId);
    await load();
  };

  const onDelete = async (taskId: string) => {
    await window.promethee.tasks.delete(taskId);
    await load();
  };

  const pending = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background)', padding: '40px', gap: 28, height: '100%', overflowY: 'auto' }}>
      {/* Header + add form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 24, fontWeight: 300, color: 'var(--foreground)', margin: 0 }}>To Do</h2>
        <form onSubmit={onAdd} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={addInputRef}
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Add a task…"
            style={{
              flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(232,146,42,0.45)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <input
            type="number"
            value={newXp}
            onChange={e => setNewXp(e.target.value)}
            placeholder="XP"
            min={1}
            max={100}
            style={{
              width: 60, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(232,146,42,0.45)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <button
            type="submit"
            disabled={!newText.trim() || adding}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(232,146,42,0.15)', border: '1px solid rgba(232,146,42,0.3)',
              borderRadius: 10, fontSize: 13, color: 'var(--accent-fire)', cursor: 'pointer',
              transition: 'opacity 0.15s', fontFamily: 'inherit',
              opacity: !newText.trim() || adding ? 0.4 : 1,
            }}
          >
            <Plus size={14} /> Add
          </button>
        </form>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}

      {!loading && tasks.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          No tasks yet. Add one above to get started.
        </p>
      )}

      {/* Pending tasks */}
      {!loading && pending.length > 0 && (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} initial="hidden" animate="visible" variants={listVariants}>
          <AnimatePresence>
            {pending.map(task => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Completed tasks */}
      {!loading && done.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, padding: '0 4px 4px' }}>
            Completed
          </div>
          <AnimatePresence>
            {done.map(task => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const done = Boolean(task.completed);
  // Anti-cheat: standalone tasks earn 10% of declared XP (min 1, cap 100)
  const declaredXp = task.xp_reward ? Math.min(100, task.xp_reward) : null;
  const earnedXp = declaredXp ? Math.max(1, Math.round(declaredXp * 0.1)) : null;

  return (
    <motion.div
      variants={rowVariants}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, transition: 'background 0.12s', position: 'relative' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: done ? 'var(--accent-fire)' : 'var(--text-muted)', transition: 'color 0.15s', display: 'flex' }}
      >
        {done ? <Check size={16} strokeWidth={2.5} /> : <Circle size={16} strokeWidth={1.5} />}
      </button>
      <span
        onClick={() => onToggle(task.id)}
        style={{ fontSize: 13, flex: 1, color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1, cursor: 'pointer', wordBreak: 'break-word' }}
      >
        {task.text}
      </span>
      {declaredXp && earnedXp && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, opacity: done ? 0.4 : 1 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-fire)' }}>+{earnedXp} XP</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}>({declaredXp}×0.1)</span>
        </span>
      )}
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        style={{ flexShrink: 0, background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-muted)', opacity: 0, transition: 'opacity 0.12s, color 0.12s', display: 'flex', alignItems: 'center', borderRadius: 4 }}
        className="todo-delete-btn"
        aria-label="Delete task"
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(248,113,113,0.9)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <Trash2 size={13} />
      </button>
    </motion.div>
  );
}
