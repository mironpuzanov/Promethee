import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

  const totalXP = profile.total_xp || 0;
  const level = profile.level || 1;
  const tier = 'Apprentice';
  const xpForNextLevel = level * 100;
  const xpProgress = Math.min((totalXP % xpForNextLevel) / xpForNextLevel, 1);

  const skills = [
    { name: 'Willpower', value: 4 },
    { name: 'Discipline', value: 2 },
    { name: 'Rigor', value: 1 },
  ];

  const xpDots = Array.from({ length: 12 }, (_, i) => i < Math.floor(xpProgress * 12));

  return (
    <motion.main
      className="flex flex-col bg-background px-10 py-10 overflow-y-auto gap-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <h1 className="text-2xl font-light text-foreground">{userName}</h1>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Level {level} · {tier}</p>
        <div className="flex items-center gap-2 mt-3">
          {xpDots.map((filled, i) => (
            <span
              key={i}
              className={`text-xs leading-none ${filled ? 'text-accent-orange' : 'text-muted'}`}
            >█</span>
          ))}
          <span className="text-sm font-medium text-secondary-foreground ml-2">{totalXP} XP</span>
        </div>
      </motion.div>

      {/* XP Progress bar */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress to Level {level + 1}</span>
          <span>{totalXP} / {xpForNextLevel}</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent-orange rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Skills */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
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
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Habits</p>
        <div className="w-full h-24 bg-card rounded-lg p-2">
          <svg width="100%" height="100%" viewBox="0 0 300 80" preserveAspectRatio="none">
            <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <polyline
              points="0,64 60,48 120,40 180,32 240,24 300,20"
              fill="none"
              stroke="#FF6B35"
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
                <stop offset="0%" stopColor="#FF6B35" stopOpacity="1" />
                <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </motion.div>
    </motion.main>
  );
}

export default CharacterPanel;
