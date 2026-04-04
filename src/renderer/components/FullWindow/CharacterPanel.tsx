import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLevelInfo } from '../../../lib/xp';
import homeBg from '../../../assets/home-bg.png';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string };
}

interface UserProfile {
  total_xp: number;
  level: number;
  display_name?: string;
  current_streak?: number;
}

interface SkillScores {
  rigueur: number;
  volonte: number;
  courage: number;
}

interface DailySignal {
  content: string;
  intensity: 'low' | 'med' | 'high';
  date: string;
}

interface CharacterPanelProps {
  user: User | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } },
};

const INTENSITY_STYLE: Record<DailySignal['intensity'], { dot: string; border: string; label: string }> = {
  low:  { dot: 'rgba(99,102,241,0.9)',  border: 'rgba(99,102,241,0.2)',  label: 'Signal' },
  med:  { dot: 'rgba(251,191,36,0.9)',  border: 'rgba(251,191,36,0.2)',  label: 'Signal' },
  high: { dot: 'rgba(239,68,68,0.9)',   border: 'rgba(239,68,68,0.25)',  label: 'Signal' },
};

function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
      <div style={{ width: 80, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: '#E8922A', borderRadius: 2 }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function CharacterPanel({ user }: CharacterPanelProps) {
  const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';
  const [profile, setProfile] = useState<UserProfile>({ total_xp: 0, level: 1 });
  const [skills, setSkills] = useState<SkillScores | null>(null);
  const [signal, setSignal] = useState<DailySignal | null>(null);

  useEffect(() => {
    window.promethee.db.getUserProfile().then((result: { success: boolean; profile?: UserProfile }) => {
      if (result.success && result.profile) {
        setProfile(result.profile);
      }
    });

    window.promethee.skills.get().then((result) => {
      if (result.success && result.skills) {
        setSkills(result.skills);
      }
    });

    window.promethee.signal.getToday().then((result) => {
      if (result.success && result.signal) {
        setSignal(result.signal);
      }
    });

    const unsub = window.promethee.signal.onNew((data) => {
      setSignal(data);
    });
    return unsub;
  }, []);

  const levelInfo = getLevelInfo(profile.total_xp || 0);
  const { level, tier, totalXP, xpIntoLevel, xpForCurrentLevel, progress: xpProgress } = levelInfo;

  return (
    <motion.main
      className="flex flex-col bg-background overflow-y-auto gap-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero header — image with stats overlaid */}
      <motion.div
        variants={itemVariants}
        style={{
          position: 'relative',
          height: 220,
          flexShrink: 0,
          overflow: 'hidden',
          backgroundImage: `url(${homeBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 60%',
        }}
      >
        {/* Gradient: transparent top, dark bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)',
        }} />

        {/* Stats overlaid at bottom-left */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 40px 20px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em' }}>{userName}</h1>
            <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.5)' }}>
              Level {level} · {tier}
              {(profile.current_streak || 0) > 0 && (
                <span style={{ marginLeft: 8 }}>· {profile.current_streak}d streak</span>
              )}
            </p>
          </div>

          {/* XP progress bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              <span>Progress to Level {level + 1}</span>
              <span>{xpIntoLevel} / {xpForCurrentLevel} XP</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: '#E8922A', borderRadius: 2 }}
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{totalXP} XP total</span>
          </div>
        </div>
      </motion.div>

      {/* Daily Signal */}
      <AnimatePresence>
        {signal && (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            style={{ paddingLeft: 40, paddingRight: 40 }}
          >
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${INTENSITY_STYLE[signal.intensity].border}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: INTENSITY_STYLE[signal.intensity].dot,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                  Prométhée · Today
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, fontStyle: 'italic' }}>
                {signal.content}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skills */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1 px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground pb-1">Skills</p>
        {skills ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <SkillBar label="Rigueur" value={skills.rigueur} />
            <SkillBar label="Volonté" value={skills.volonte} />
            <SkillBar label="Courage" value={skills.courage} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <SkillBar label="Rigueur" value={0} />
            <SkillBar label="Volonté" value={0} />
            <SkillBar label="Courage" value={0} />
          </div>
        )}
      </motion.div>

      {/* Streak info */}
      {(profile.current_streak || 0) > 1 && (
        <motion.div variants={itemVariants} className="px-10 pb-10">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            background: 'rgba(232,146,42,0.06)',
            border: '1px solid rgba(232,146,42,0.15)',
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                {profile.current_streak}-day streak
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                XP multiplier active · +{Math.min(profile.current_streak * 10, 50)}%
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.main>
  );
}

export default CharacterPanel;
