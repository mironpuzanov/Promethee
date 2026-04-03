import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

function CharacterPanel({ user }: CharacterPanelProps) {
  const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';
  const [profile, setProfile] = useState<UserProfile>({ total_xp: 0, level: 1 });

  useEffect(() => {
    window.promethee.db.getUserProfile().then((result: { success: boolean; profile?: UserProfile }) => {
      if (result.success && result.profile) {
        setProfile(result.profile);
      }
    });
  }, []);

  const levelInfo = getLevelInfo(profile.total_xp || 0);
  const { level, tier, totalXP, xpIntoLevel, xpForCurrentLevel, progress: xpProgress } = levelInfo;

  const skills = [
    { name: 'Willpower', value: 4 },
    { name: 'Discipline', value: 2 },
    { name: 'Rigor', value: 1 },
  ];

  const xpDots = Array.from({ length: 12 }, (_, i) => i < Math.floor(xpProgress * 12));

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

      {/* Skills */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Skills</p>
        <div className="flex flex-col gap-2">
          {skills.map(skill => (
            <div key={skill.name} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <span className="text-sm text-secondary-foreground">{skill.name}</span>
              <span className="text-base font-medium text-foreground">{skill.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Habits chart */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 px-10 pb-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Habits</p>
        <div className="w-full h-24 bg-card rounded-lg p-2">
          <svg width="100%" height="100%" viewBox="0 0 300 80" preserveAspectRatio="none">
            <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <polyline
              points="0,64 60,48 120,40 180,32 240,24 300,20"
              fill="none"
              stroke="#E8922A"
              strokeWidth="2"
              opacity="0.6"
            />
            <polyline
              points="0,64 60,48 120,40 180,32 240,24 300,20"
              fill="url(#grad)"
              stroke="none"
              opacity="0.1"
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8922A" stopOpacity="1" />
                <stop offset="100%" stopColor="#E8922A" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </motion.div>
    </motion.main>
  );
}

export default CharacterPanel;
