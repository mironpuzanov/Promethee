import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckCircle2, Circle, ChevronDown, Flame } from 'lucide-react';

type Frequency = 'daily' | 'weekly';

interface Habit {
  id: string;
  title: string;
  frequency: Frequency;
  last_completed_date: string | null;
  current_streak: number;
  created_at: number;
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 18 } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.15 } },
};

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
}

export default function HabitsTab() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formFrequency, setFormFrequency] = useState<Frequency>('daily');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const result = await window.promethee.habits.list();
    if (result.success) setHabits(result.habits || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || submitting) return;
    setSubmitting(true);
    const result = await window.promethee.habits.create(formTitle.trim(), formFrequency);
    if (result.success && result.habit) {
      setHabits(prev => [...prev, result.habit]);
      setFormTitle('');
      setFormFrequency('daily');
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const handleToggle = async (habit: Habit) => {
    const today = todayStr();
    if (habit.last_completed_date === today) {
      // Uncomplete
      const result = await window.promethee.habits.uncomplete(habit.id);
      if (result.success && result.habit) {
        setHabits(prev => prev.map(h => h.id === habit.id ? result.habit : h));
      }
    } else {
      const result = await window.promethee.habits.complete(habit.id);
      if (result.success && result.habit) {
        setHabits(prev => prev.map(h => h.id === habit.id ? result.habit : h));
      }
    }
  };

  const handleDelete = async (habitId: string) => {
    await window.promethee.habits.delete(habitId);
    setHabits(prev => prev.filter(h => h.id !== habitId));
  };

  const today = todayStr();

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6" style={{ minHeight: 0, flex: 1 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-light text-foreground">Habits</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}
        >
          <Plus size={15} />
          New habit
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            key="habit-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            onSubmit={handleCreate}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <input
                autoFocus
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Habit title…"
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  color: 'var(--foreground)',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Frequency selector */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <select
                    value={formFrequency}
                    onChange={e => setFormFrequency(e.target.value as Frequency)}
                    style={{
                      appearance: 'none',
                      background: 'var(--input)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '9px 32px 9px 12px',
                      color: 'var(--foreground)',
                      fontSize: 13,
                      outline: 'none',
                      fontFamily: 'inherit',
                      width: '100%',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="daily" style={{ background: 'var(--background)' }}>Daily</option>
                    <option value="weekly" style={{ background: 'var(--background)' }}>Weekly</option>
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
                <button
                  type="submit"
                  disabled={!formTitle.trim() || submitting}
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: formTitle.trim() && !submitting ? 'pointer' : 'not-allowed',
                    opacity: formTitle.trim() && !submitting ? 1 : 0.4,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {submitting ? 'Adding…' : 'Add habit'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '4px 8px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Habit list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : habits.length === 0 && !showForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16 }}>
          <p className="text-sm text-muted-foreground">No habits yet.</p>
          <p className="text-sm text-muted-foreground" style={{ maxWidth: 420 }}>
            Habits are discipline checkpoints — they don't give XP, they build streaks. One checkbox per day.
          </p>
        </div>
      ) : (
        <motion.div
          className="flex flex-col gap-2"
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          <AnimatePresence mode="popLayout">
            {habits.map(habit => {
              const isDone = habit.last_completed_date === today;
              const streak = habit.current_streak || 0;
              return (
                <motion.div
                  key={habit.id}
                  variants={itemVariants}
                  exit="exit"
                  layout
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: isDone ? 'transparent' : 'var(--surface)',
                    border: `1px solid ${isDone ? 'transparent' : 'var(--border)'}`,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  {/* Completion toggle */}
                  <button
                    onClick={() => handleToggle(habit)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--accent-fire)' }} />
                    ) : (
                      <Circle size={18} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>

                  {/* Title */}
                  <span style={{
                    flex: 1,
                    fontSize: 14,
                    color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: isDone ? 'line-through' : 'none',
                    transition: 'color 0.2s',
                  }}>
                    {habit.title}
                  </span>

                  {/* Frequency badge */}
                  <span style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    {habit.frequency}
                  </span>

                  {/* Streak */}
                  {streak > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <Flame size={12} style={{ color: streak >= 7 ? 'var(--accent-fire)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: 12, color: streak >= 7 ? 'var(--accent-fire)' : 'var(--text-muted)', fontWeight: streak >= 7 ? 600 : 400 }}>
                        {streak}
                      </span>
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(habit.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}
                    title="Delete habit"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
