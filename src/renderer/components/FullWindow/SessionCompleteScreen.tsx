import React, { useEffect, useState } from 'react';
import { shouldIncludeAppInUsageStats } from '../../../lib/appUsageFilter.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, Trophy, Share2, X, Download } from 'lucide-react';
import forestBg from '../../../assets/forest-bg.png';
import logoIcon from '../../../assets/logo-blanc.svg';

interface Props {
  task: string;
  durationSeconds: number;
  xpEarned: number;
  multiplier?: number;
  streakBonus?: number;
  depthBonus?: number;
  currentStreak?: number;
  sessionId?: string;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Summarise window events into top apps with % time
function summariseApps(events: Array<{ app_name: string }>): Array<{ name: string; pct: number }> {
  const filtered = events.filter((e) => shouldIncludeAppInUsageStats(e.app_name || ''));
  if (!filtered.length) return [];
  const counts: Record<string, number> = {};
  for (const e of filtered) counts[e.app_name] = (counts[e.app_name] || 0) + 1;
  const total = filtered.length;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, pct: Math.round((count / total) * 100) }));
}

export default function SessionCompleteScreen({ task, durationSeconds, xpEarned, multiplier, streakBonus, depthBonus, currentStreak, sessionId, onClose }: Props) {
  const [rank, setRank] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [shareOpen, setShareOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [topApps, setTopApps] = useState<Array<{ name: string; pct: number }>>([]);

  useEffect(() => {
    window.promethee.auth.getUser().then((ur: any) => {
      if (ur.success && ur.user) {
        const name = ur.user.user_metadata?.display_name || ur.user.email?.split('@')[0] || '';
        setUserName(name);
        if (ur.user.user_metadata?.avatar_url) setAvatarUrl(ur.user.user_metadata.avatar_url);
        window.promethee.leaderboard.get().then((r: any) => {
          if (r.success && r.leaderboard) {
            const entry = r.leaderboard.find((e: any) => e.id === ur.user.id);
            if (entry?.rank) setRank(entry.rank);
          }
        });
      }
    });
    if (sessionId) {
      window.promethee.tracking.getEvents({ sessionId }).then((r: any) => {
        if (r.success && r.events?.length) setTopApps(summariseApps(r.events));
      });
    }
    return () => { window.promethee.window.restoreFromSessionComplete(); };
  }, [sessionId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const tweetText = `Just finished "${task}" — ${formatDuration(durationSeconds)}${xpEarned > 0 ? ` / +${xpEarned} XP` : ''}${rank ? ` / Rank #${rank}` : ''} 🔥\n\nTracking deep work with @promethee_app — promethee.app`;

  // Close sheet, wait for animation to fully finish, then capture
  const captureClean = (): Promise<void> => new Promise(resolve => {
    setShareOpen(false);
    setTimeout(resolve, 400); // framer exit animation is ~300ms
  });

  const shareActions: { id: string; label: string; icon: React.ReactNode; color: string; bg: string; action: () => Promise<void> }[] = [
    {
      id: 'twitter',
      label: 'Image copied — paste with ⌘V',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.857L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: '#000',
      bg: '#fff',
      action: async () => {
        await captureClean();
        await window.promethee.window.copyImageToClipboard();
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        await window.promethee.window.openExternal(url);
        showToast('Image copied — paste in your tweet with ⌘V');
      },
    },
    {
      id: 'linkedin',
      label: 'Image copied — paste with ⌘V',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      color: '#fff',
      bg: '#0A66C2',
      action: async () => {
        await captureClean();
        await window.promethee.window.copyImageToClipboard();
        const url = `https://www.linkedin.com/feed/?shareActive=true`;
        await window.promethee.window.openExternal(url);
        showToast('Image copied — paste with ⌘V');
      },
    },
    {
      id: 'whatsapp',
      label: 'Text pre-filled — image copied too',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      color: '#fff',
      bg: '#25D366',
      action: async () => {
        await captureClean();
        await window.promethee.window.copyImageToClipboard();
        const text = `Just finished "${task}" — ${formatDuration(durationSeconds)}${xpEarned > 0 ? ` / +${xpEarned} XP` : ''}\n\nTrack your deep work on promethee.app`;
        await window.promethee.window.openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`);
        showToast('Image copied — paste with Ctrl+V in WhatsApp');
      },
    },
    {
      id: 'save',
      label: 'Save to Downloads',
      icon: <Download size={18} />,
      color: 'var(--foreground)',
      bg: 'rgba(255,255,255,0.12)',
      action: async () => {
        await captureClean();
        const r = await window.promethee.window.captureSessionCard();
        if (r.success) showToast('Saved — revealed in Finder');
      },
    },
    {
      id: 'copy',
      label: 'Copy Image',
      icon: <Share2 size={18} />,
      color: 'var(--foreground)',
      bg: 'rgba(255,255,255,0.12)',
      action: async () => {
        await captureClean();
        await window.promethee.window.copyImageToClipboard();
        showToast('Image copied to clipboard');
      },
    },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      fontFamily: 'Geist, -apple-system, sans-serif',
    }}>
      {/* Drag region */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 48, WebkitAppRegion: 'drag' as any, zIndex: 10 }} />

      {/* Forest image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${forestBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.2) 30%, transparent 50%, transparent 65%, rgba(0,0,0,0.5) 100%)',
      }} />

      {/* Dim when share open */}
      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShareOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 20 }}
          />
        )}
      </AnimatePresence>

      {/* TOP BAR */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        style={{
          position: 'absolute', top: 48, left: 0, right: 0,
          padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <img src={logoIcon} alt="" style={{ width: 22, height: 22, borderRadius: 6, opacity: 0.92 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Promethee
          </span>
        </div>
        {userName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: 'var(--foreground)',
              }}>
                {userName[0]?.toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{userName}</span>
          </div>
        )}
      </motion.div>

      {/* STATS */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: 'spring', stiffness: 180, damping: 22 }}
        style={{
          position: 'absolute', top: 96, left: 0, right: 0,
          padding: '0 20px', color: '#fff',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Session complete
          </span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
            {task}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Stat icon={<Clock size={11} color="rgba(255,255,255,0.4)" />} label="Time" value={formatDuration(durationSeconds)} />
          <Stat icon={<Zap size={11} color="var(--accent-fire)" />} label="XP" value={xpEarned > 0 ? `+${xpEarned}` : '0'} valueColor="var(--accent-fire)" />
          {rank && <Stat icon={<Trophy size={11} color="rgba(255,255,255,0.4)" />} label="Rank" value={`#${rank}`} />}
        </div>
        {/* Multiplier — muted text only (matches Apps used / stat hierarchy) */}
        {multiplier && multiplier > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(streakBonus || 0) > 0 && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', fontWeight: 400, lineHeight: 1.35 }}>
                {currentStreak}-day streak · +{Math.round((streakBonus || 0) * 100)}% XP
              </span>
            )}
            {(depthBonus || 0) > 0 && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', fontWeight: 400, lineHeight: 1.35 }}>
                Deep work · +25% XP
              </span>
            )}
          </div>
        )}

        {/* App breakdown */}
        {topApps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
              Apps used
            </span>
            {topApps.map(({ name, pct }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </span>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'rgba(255,255,255,0.45)', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 28, textAlign: 'right' }}>{pct}%</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* SHARE SHEET — slides up from bottom */}
      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ y: 180, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 180, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'absolute', bottom: 90, left: 0, right: 0,
              padding: '0 16px',
              zIndex: 30,
            }}
          >
            <div style={{
              background: 'rgba(18,16,14,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 20,
              border: '1px solid var(--border)',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 4, paddingBottom: 4 }}>
                Share session
              </span>
              {shareActions.map((action) => (
                <button
                  key={action.id}
                  onClick={action.action}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: action.bg,
                    border: 'none',
                    borderRadius: 12,
                    padding: '11px 14px',
                    color: action.color,
                    fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              position: 'absolute', bottom: 100, left: 0, right: 0,
              display: 'flex', justifyContent: 'center',
              zIndex: 50, pointerEvents: 'none',
            }}
          >
            <div style={{
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(10px)',
              borderRadius: 20,
              padding: '8px 16px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.85)',
            }}>
              {toastMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM BUTTONS */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 180, damping: 22 }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 20px 28px',
          display: 'flex', gap: 10,
          zIndex: 40,
        }}
      >
        <button
          onClick={() => setShareOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: shareOpen ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '14px 0',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            transition: 'background 0.15s',
          }}
        >
          <Share2 size={14} />
          Share
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'var(--primary)',
            border: 'none', borderRadius: 12, padding: '14px 0',
            color: 'var(--primary-foreground)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <X size={14} />
          Close
        </button>
      </motion.div>
    </div>
  );
}

function Stat({ icon, label, value, valueColor = 'var(--foreground)' }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: 26, fontWeight: 500, color: valueColor, letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
        {value}
      </span>
    </div>
  );
}
