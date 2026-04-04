import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Plus, Trash2, CheckCircle2, Circle, ChevronDown } from 'lucide-react';

type QuestType = 'daily' | 'mid' | 'long';

interface Quest {
  id: string;
  title: string;
  type: QuestType;
  xp_reward: number;
  completed_at: number | null;
  created_at: number;
}

const TYPE_LABELS: Record<QuestType, string> = {
  daily: 'Daily',
  mid: 'Mid-term',
  long: 'Long-term',
};

const TYPE_XP_DEFAULTS: Record<QuestType, number> = {
  daily: 15,
  mid: 50,
  long: 200,
};

const TYPE_COLOR: Record<QuestType, string> = {
  daily: 'rgba(251,191,36,0.9)',   // amber
  mid: 'rgba(139,92,246,0.9)',     // violet
  long: 'rgba(59,130,246,0.9)',    // blue
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 18 } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.15 } },
};

function XPFlash({ xp }: { xp: number }) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -28, scale: 1.2 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        right: 8,
        top: -4,
        pointerEvents: 'none',
        color: 'var(--accent-fire)',
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      +{xp} XP
    </motion.div>
  );
}

export default function QuestsTab() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<QuestType>('mid');
  const [formXp, setFormXp] = useState<number>(50);
  const [xpFlashes, setXpFlashes] = useState<{ questId: string; xp: number; key: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const result = await window.promethee.quests.list();
    if (result.success) setQuests(result.quests || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Listen for daily reset so the list refreshes automatically at midnight
    const unsub = window.promethee.quests.onDailyReset(() => load());
    return unsub;
  }, [load]);

  // Sync xp default when type changes
  useEffect(() => {
    setFormXp(TYPE_XP_DEFAULTS[formType]);
  }, [formType]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || submitting) return;
    setSubmitting(true);
    const result = await window.promethee.quests.create(formTitle.trim(), formType, formXp);
    if (result.success && result.quest) {
      setQuests(prev => [...prev, result.quest]);
      setFormTitle('');
      setFormType('mid');
      setFormXp(50);
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const handleComplete = async (quest: Quest) => {
    if (quest.completed_at) {
      // Uncomplete
      const result = await window.promethee.quests.uncomplete(quest.id);
      if (result.success) {
        setQuests(prev => prev.map(q => q.id === quest.id ? result.quest : q));
      }
      return;
    }
    const result = await window.promethee.quests.complete(quest.id);
    if (result.success) {
      setQuests(prev => prev.map(q => q.id === quest.id ? result.quest : q));
      // Show XP flash
      const key = Date.now();
      setXpFlashes(prev => [...prev, { questId: quest.id, xp: quest.xp_reward, key }]);
      setTimeout(() => {
        setXpFlashes(prev => prev.filter(f => f.key !== key));
      }, 900);
    }
  };

  const handleDelete = async (questId: string) => {
    await window.promethee.quests.delete(questId);
    setQuests(prev => prev.filter(q => q.id !== questId));
  };

  // Group by type order
  const groups: { type: QuestType; quests: Quest[] }[] = [
    { type: 'daily', quests: quests.filter(q => q.type === 'daily') },
    { type: 'mid', quests: quests.filter(q => q.type === 'mid') },
    { type: 'long', quests: quests.filter(q => q.type === 'long') },
  ].filter(g => g.quests.length > 0);

  return (
    <div className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-6" style={{ minHeight: 0, flex: 1 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-light text-foreground">Quests</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}
        >
          <Plus size={15} />
          New quest
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            key="quest-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            onSubmit={handleCreate}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <input
                autoFocus
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Quest title…"
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
                {/* Type selector */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as QuestType)}
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
                    <option value="mid" style={{ background: 'var(--background)' }}>Mid-term</option>
                    <option value="long" style={{ background: 'var(--background)' }}>Long-term</option>
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
                {/* XP reward */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px' }}>
                  <Zap size={13} style={{ color: 'var(--accent-fire)' }} />
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={formXp}
                    onChange={e => setFormXp(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--foreground)',
                      fontSize: 13,
                      outline: 'none',
                      fontFamily: 'inherit',
                      width: 48,
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>XP</span>
                </div>
                {/* Submit */}
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
                  {submitting ? 'Adding…' : 'Add quest'}
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

      {/* Quest list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : quests.length === 0 && !showForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16 }}>
          <p className="text-sm text-muted-foreground">No quests yet.</p>
          <p className="text-sm text-muted-foreground" style={{ maxWidth: 420 }}>
            Quests are your objectives — daily habits, medium-term milestones, or long-term goals. Completing them earns XP.
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
            <div key={group.type} className="flex flex-col gap-1">
              {/* Section label */}
              <div
                className="text-xs font-medium tracking-wide uppercase px-1 pb-2"
                style={{ color: TYPE_COLOR[group.type], opacity: 0.7 }}
              >
                {TYPE_LABELS[group.type]}
              </div>
              <AnimatePresence mode="popLayout">
                {group.quests.map(quest => {
                  const flash = xpFlashes.find(f => f.questId === quest.id);
                  const isDone = !!quest.completed_at;
                  return (
                    <motion.div
                      key={quest.id}
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
                        position: 'relative',
                        transition: 'background 0.2s, border-color 0.2s',
                      }}
                    >
                      {/* Completion toggle */}
                      <button
                        onClick={() => handleComplete(quest)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={18} style={{ color: TYPE_COLOR[quest.type] }} />
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
                        {quest.title}
                      </span>

                      {/* XP badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <Zap size={11} style={{ color: 'var(--accent-fire)', opacity: 0.6 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{quest.xp_reward} XP</span>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(quest.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}
                        title="Delete quest"
                      >
                        <Trash2 size={13} />
                      </button>

                      {/* XP flash */}
                      {flash && <XPFlash key={flash.key} xp={flash.xp} />}
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
