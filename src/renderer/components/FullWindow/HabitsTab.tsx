import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckCircle2, Circle, ChevronDown, Flame } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Frequency = 'daily' | 'weekly';

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
};

const FREQUENCY_COLOR: Record<Frequency, string> = {
  daily: 'rgba(251,191,36,0.9)',
  weekly: 'rgba(139,92,246,0.9)',
};

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

function dateStrOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA');
}

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/** Build last-7-day completion data from actual habit_completions history. */
function buildChartData(
  habits: Habit[],
  completions: Record<string, string[]>
): { day: string; daily: number; weekly: number }[] {
  // Build lookup: habitId -> Set of completed dates
  const completionSets: Record<string, Set<string>> = {};
  for (const [habitId, dates] of Object.entries(completions)) {
    completionSets[habitId] = new Set(dates);
  }

  return Array.from({ length: 7 }, (_, i) => {
    const offset = -(6 - i);
    const dateStr = dateStrOffset(offset);
    let daily = 0;
    let weekly = 0;
    for (const h of habits) {
      const set = completionSets[h.id];
      if (!set?.has(dateStr)) continue;
      if (h.frequency === 'daily') daily++;
      else weekly++;
    }
    return { day: shortDay(dateStr), daily, weekly };
  });
}

export default function HabitsTab() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formFrequency, setFormFrequency] = useState<Frequency>('daily');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [habitRes, completionRes] = await Promise.all([
      window.promethee.habits.list(),
      (window.promethee.habits as any).getAllCompletions?.(30).catch(() => ({ success: false })),
    ]);
    if (habitRes.success) setHabits(habitRes.habits || []);
    if (completionRes?.success) setCompletions(completionRes.completions || {});
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Reload when streaks are expired by daily jobs
    const remove = (window.promethee.habits as any).onStreaksExpired(() => load());
    return remove;
  }, [load]);

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
      const result = await window.promethee.habits.uncomplete(habit.id);
      if (result.success && result.habit) {
        setHabits(prev => prev.map(h => h.id === habit.id ? result.habit : h));
        setCompletions(prev => ({
          ...prev,
          [habit.id]: (prev[habit.id] || []).filter(d => d !== today),
        }));
      }
    } else {
      const result = await window.promethee.habits.complete(habit.id);
      if (result.success && result.habit) {
        setHabits(prev => prev.map(h => h.id === habit.id ? result.habit : h));
        setCompletions(prev => ({
          ...prev,
          [habit.id]: [...new Set([...(prev[habit.id] || []), today])],
        }));
      }
    }
  };

  const handleDelete = async (habitId: string) => {
    await window.promethee.habits.delete(habitId);
    setHabits(prev => prev.filter(h => h.id !== habitId));
  };

  const today = todayStr();

  const groups: { frequency: Frequency; habits: Habit[] }[] = [
    { frequency: 'daily', habits: habits.filter(h => h.frequency === 'daily') },
    { frequency: 'weekly', habits: habits.filter(h => h.frequency === 'weekly') },
  ].filter(g => g.habits.length > 0);

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

      {/* Completion chart — only shown when there are habits */}
      {!loading && habits.length > 0 && (
        <HabitsChart habits={habits} completions={completions} />
      )}

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
          className="flex flex-col gap-6"
          initial="hidden"
          animate="visible"
          variants={listVariants}
        >
          {groups.map(group => (
            <div key={group.frequency} className="flex flex-col gap-1">
              <div
                className="text-xs font-medium tracking-wide uppercase px-1 pb-2"
                style={{ color: FREQUENCY_COLOR[group.frequency], opacity: 0.85 }}
              >
                {FREQUENCY_LABELS[group.frequency]}
              </div>
              <AnimatePresence mode="popLayout">
                {group.habits.map(habit => {
                  const isDone = habit.last_completed_date === today;
                  const streak = habit.current_streak || 0;
                  const accent = FREQUENCY_COLOR[habit.frequency];
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
                      <button
                        type="button"
                        onClick={() => handleToggle(habit)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={18} style={{ color: accent }} />
                        ) : (
                          <Circle size={18} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </button>

                      <span style={{
                        flex: 1,
                        fontSize: 14,
                        color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: isDone ? 'line-through' : 'none',
                        transition: 'color 0.2s',
                      }}>
                        {habit.title}
                      </span>

                      {streak > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <Flame size={12} style={{ color: streak >= 7 ? 'var(--accent-fire)' : 'var(--text-muted)' }} />
                          <span style={{ fontSize: 12, color: streak >= 7 ? 'var(--accent-fire)' : 'var(--text-muted)', fontWeight: streak >= 7 ? 600 : 400 }}>
                            {streak}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
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
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function HabitsChart({ habits, completions }: { habits: Habit[]; completions: Record<string, string[]> }) {
  const data = buildChartData(habits, completions);
  const hasDailyHabits = habits.some(h => h.frequency === 'daily');
  const hasWeeklyHabits = habits.some(h => h.frequency === 'weekly');
  const totalToday = habits.filter(h => h.last_completed_date === todayStr()).length;
  const totalHabits = habits.length;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '18px 20px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>Last 7 days</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {totalToday} of {totalHabits} done today
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {hasDailyHabits && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(251,191,36,0.9)', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Daily</span>
            </div>
          )}
          {hasWeeklyHabits && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(139,92,246,0.9)', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weekly</span>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ left: -28, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillDaily" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(251,191,36,0.9)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="rgba(251,191,36,0.9)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillWeekly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(139,92,246,0.9)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="rgba(139,92,246,0.9)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
          <YAxis
            allowDecimals={false}
            domain={[0, 'dataMax + 1']}
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'inherit' }}
            tickMargin={6}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--foreground)',
              fontFamily: 'inherit',
            }}
            itemStyle={{ color: 'var(--text-secondary)' }}
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          />
          {hasDailyHabits && (
            <Area
              dataKey="daily"
              name="Daily"
              type="monotone"
              fill="url(#fillDaily)"
              stroke="rgba(251,191,36,0.9)"
              strokeWidth={1.5}
              fillOpacity={1}
              stackId="a"
              dot={false}
              activeDot={{ r: 3, fill: 'rgba(251,191,36,0.9)', strokeWidth: 0 }}
            />
          )}
          {hasWeeklyHabits && (
            <Area
              dataKey="weekly"
              name="Weekly"
              type="monotone"
              fill="url(#fillWeekly)"
              stroke="rgba(139,92,246,0.9)"
              strokeWidth={1.5}
              fillOpacity={1}
              stackId="a"
              dot={false}
              activeDot={{ r: 3, fill: 'rgba(139,92,246,0.9)', strokeWidth: 0 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
