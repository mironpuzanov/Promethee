import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor, ChevronRight, Check, X } from 'lucide-react';

interface Props {
  onDone: () => void;
}

type CardState = 'idle' | 'waiting' | 'granted' | 'denied' | 'skipped';

export default function PermissionsOnboardingScreen({ onDone }: Props) {
  const [state, setState] = useState<CardState>('idle');
  const [checking, setChecking] = useState(false);

  // Mark seen immediately on mount — screen is non-blocking, user shouldn't see it again on next launch
  React.useEffect(() => {
    (window.promethee as any).onboarding.permsMarkSeen().catch(() => {});
  }, []);

  const handleOpenSettings = async () => {
    setState('waiting');
    await (window.promethee.window as any).openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    );
  };

  const handleCheckPermission = async () => {
    setChecking(true);
    try {
      const probeResult = await (window.promethee as any).onboarding.probeScreenRecording();
      setState(probeResult?.ok ? 'granted' : 'denied');
    } catch {
      setState('denied');
    } finally {
      setChecking(false);
    }
  };

  // Skip immediately completes the flow — no second button needed
  const handleSkip = () => {
    onDone();
  };

  const handleFinish = async () => {
    onDone();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6">
      <div className="mb-10 text-center">
        <div className="text-2xl font-light text-foreground mb-1">One quick permission</div>
        <div className="text-sm text-muted-foreground">Optional — you can change this any time in System Settings.</div>
      </div>

      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl bg-card border border-border/60 p-6 flex flex-col gap-4"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground"><Monitor size={22} strokeWidth={1.5} /></div>
            <div className="text-base font-medium text-foreground">Screen Recording</div>
            {state === 'granted' && (
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Allowed</span>
            )}
            {state === 'skipped' && (
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Skipped</span>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Promethee reads which app is in front to track your focus time. No video is ever recorded — just the window title.
          </p>

          {/* Step 1: idle — offer to open settings */}
          {state === 'idle' && (
            <div className="flex gap-2">
              <button
                onClick={handleOpenSettings}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
              >
                Open System Settings
              </button>
              <button
                onClick={handleSkip}
                className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/40 transition-colors"
              >
                Skip
              </button>
            </div>
          )}

          {/* Step 2: waiting — user went to settings, now confirm */}
          {state === 'waiting' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                In System Settings, find <strong className="text-foreground">Promethee</strong> (or <strong className="text-foreground">Electron</strong> in dev) under Screen Recording and toggle it on. If Promethee still cannot detect it after that, fully quit the app with <strong className="text-foreground">⌘Q</strong> and reopen it, then come back and tap below.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCheckPermission}
                  disabled={checking}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {checking ? 'Checking…' : "I've allowed it"}
                </button>
                <button
                  onClick={handleSkip}
                  className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/40 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step 3a: granted */}
          {state === 'granted' && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <Check size={14} strokeWidth={2.5} />
              <span>Permission granted. Focus tracking is active.</span>
            </div>
          )}

          {/* Step 3b: denied — let them try again or skip */}
          {state === 'denied' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <X size={14} strokeWidth={2.5} />
                <span>Not detected yet. Toggle it on and try again. If you already allowed it, fully quit Promethee and reopen it first.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCheckPermission}
                  disabled={checking}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {checking ? 'Checking…' : 'Try again'}
                </button>
                <button
                  onClick={handleSkip}
                  className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/40 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

        </motion.div>

        {state === 'granted' && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
            >
              Continue
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
