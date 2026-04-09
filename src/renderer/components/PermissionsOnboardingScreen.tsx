import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Monitor, ChevronRight, Check, RotateCcw } from 'lucide-react';

interface Props {
  onDone: () => void;
}

type StepId = 'accessibility' | 'screen-recording';
type CardState = 'idle' | 'waiting' | 'granted' | 'needs-restart';

interface Step {
  id: StepId;
  icon: React.ReactNode;
  title: string;
  why: string;
  settingsUrl: string;
}

const STEPS: Step[] = [
  {
    id: 'accessibility',
    icon: <Eye size={22} strokeWidth={1.5} />,
    title: 'Accessibility',
    why: 'Lets Promethee read which app is in front so it can track your focus time. No keystrokes or content are ever read.',
    settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  },
  {
    id: 'screen-recording',
    icon: <Monitor size={22} strokeWidth={1.5} />,
    title: 'Screen Recording',
    why: 'Lets Promethee read window titles so it knows what you\'re working on. No video is ever recorded.',
    settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  },
];

export default function PermissionsOnboardingScreen({ onDone }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>('idle');
  const [checking, setChecking] = useState(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const handleOpenSettings = async () => {
    setCardState('waiting');
    await (window.promethee.window as any).openExternal(step.settingsUrl);
    // For screen recording: mark acknowledged so native dialog doesn't re-fire
    if (step.id === 'screen-recording') {
      await (window.promethee as any).onboarding.markScreenRecordingAcknowledged();
    }
  };

  const handleCheckAccessibility = async () => {
    setChecking(true);
    try {
      const result = await (window.promethee as any).onboarding.probeAccessibility();
      setCardState(result?.ok ? 'granted' : 'waiting');
    } catch {
      setCardState('waiting');
    } finally {
      setChecking(false);
    }
  };

  const handleRestartForScreenRecording = async () => {
    await (window.promethee as any).onboarding.relaunchApp();
  };

  const handleNext = () => {
    if (isLast) {
      (window.promethee as any).onboarding.permsMarkSeen().catch(() => {});
      onDone();
    } else {
      setStepIndex(stepIndex + 1);
      setCardState('idle');
    }
  };

  const handleSkip = () => {
    if (isLast) {
      (window.promethee as any).onboarding.permsMarkSeen().catch(() => {});
      onDone();
    } else {
      setStepIndex(stepIndex + 1);
      setCardState('idle');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="text-2xl font-light text-foreground mb-1">
          {stepIndex === 0 ? 'Two quick permissions' : 'One more permission'}
        </div>
        <div className="text-sm text-muted-foreground">
          Step {stepIndex + 1} of {STEPS.length} — you can skip either one.
        </div>
      </div>

      {/* Step dots */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === stepIndex
                ? 'w-6 bg-accent'
                : i < stepIndex
                ? 'w-3 bg-accent/40'
                : 'w-3 bg-border'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm"
        >
          <div className="rounded-2xl bg-card border border-border/60 p-6 flex flex-col gap-4">
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">{step.icon}</div>
              <div className="text-base font-medium text-foreground">{step.title}</div>
              {cardState === 'granted' && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                  Allowed
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{step.why}</p>

            {/* idle — offer to open settings */}
            {cardState === 'idle' && (
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

            {/* waiting — accessibility: check; screen-recording: restart */}
            {cardState === 'waiting' && step.id === 'accessibility' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  In System Settings, find <strong className="text-foreground">Promethee</strong> under Accessibility and toggle it on. Then come back and tap below.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCheckAccessibility}
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

            {/* waiting — screen recording: always restart */}
            {cardState === 'waiting' && step.id === 'screen-recording' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  In System Settings, find <strong className="text-foreground">Promethee</strong> under Screen Recording and toggle it on. macOS requires a full restart to apply this — tap below when ready.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRestartForScreenRecording}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
                  >
                    <RotateCcw size={13} strokeWidth={2} />
                    Restart Promethee to apply
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

            {/* granted */}
            {cardState === 'granted' && (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <Check size={14} strokeWidth={2.5} />
                <span>Permission granted.</span>
              </div>
            )}
          </div>

          {/* Continue / next */}
          {cardState === 'granted' && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
              >
                {isLast ? 'Go to dashboard' : 'Next'}
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
