// XP and level system
//
// XP earned: 10 XP per minute, minimum 60s for any XP
// Level threshold: level * 100 XP (Level 1→2: 100 XP, Level 2→3: 200 XP, ...)
// Total XP to reach level N: sum of 100+200+...+(N-1)*100 = N*(N-1)/2 * 100

export interface LevelInfo {
  level: number;
  tier: string;
  totalXP: number;
  xpIntoLevel: number;      // XP earned within current level
  xpForCurrentLevel: number; // XP needed to complete current level
  progress: number;          // 0–1 fraction
}

const TIERS: { minLevel: number; name: string }[] = [
  { minLevel: 1,  name: 'Apprentice' },
  { minLevel: 3,  name: 'Initiate'   },
  { minLevel: 6,  name: 'Seeker'     },
  { minLevel: 11, name: 'Warrior'    },
  { minLevel: 21, name: 'Champion'   },
  { minLevel: 41, name: 'Legend'     },
];

export function getTier(level: number): string {
  let tier = TIERS[0].name;
  for (const t of TIERS) {
    if (level >= t.minLevel) tier = t.name;
    else break;
  }
  return tier;
}

export function xpForLevel(level: number): number {
  return level * 100;
}

// Total XP required to reach the START of a given level
export function totalXPToReachLevel(level: number): number {
  // sum of 100 + 200 + ... + (level-1)*100
  const n = level - 1;
  return n * (n + 1) / 2 * 100;
}

export function getLevelInfo(totalXP: number): LevelInfo {
  // Find current level: largest level where totalXPToReachLevel(level) <= totalXP
  let level = 1;
  while (totalXPToReachLevel(level + 1) <= totalXP) {
    level++;
  }

  const xpStartOfLevel = totalXPToReachLevel(level);
  const xpForCurrentLevel = xpForLevel(level);
  const xpIntoLevel = totalXP - xpStartOfLevel;
  const progress = Math.min(xpIntoLevel / xpForCurrentLevel, 1);

  return {
    level,
    tier: getTier(level),
    totalXP,
    xpIntoLevel,
    xpForCurrentLevel,
    progress,
  };
}
