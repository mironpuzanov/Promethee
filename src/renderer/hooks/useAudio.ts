import { useEffect, useRef, useCallback } from 'react';

const FADE_DURATION = 1500;
const DEFAULT_VOLUME = 0.18;

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  duration: number,
  onDone?: () => void
): ReturnType<typeof setInterval> {
  const steps = 30;
  const stepTime = duration / steps;
  const stepVol = (to - from) / steps;
  let step = 0;
  audio.volume = from;
  const id = setInterval(() => {
    step++;
    audio.volume = Math.min(1, Math.max(0, from + stepVol * step));
    if (step >= steps) {
      clearInterval(id);
      audio.volume = to;
      onDone?.();
    }
  }, stepTime);
  return id;
}

export type AudioState = 'dashboard' | 'session-active' | 'silent';

export function useAudio() {
  const dashboardAudio = useRef<HTMLAudioElement | null>(null);
  const currentState = useRef<AudioState>('silent');
  const fadeIds = useRef<(ReturnType<typeof setInterval>)[]>([]);
  const muted = useRef(false);
  const ready = useRef(false);
  const pendingState = useRef<AudioState | null>(null);

  const clearFades = useCallback(() => {
    fadeIds.current.forEach((id) => clearInterval(id));
    fadeIds.current = [];
  }, []);

  const doTransition = useCallback((state: AudioState) => {
    const da = dashboardAudio.current;
    if (!da) return;

    currentState.current = state;
    clearFades();

    if (state === 'dashboard') {
      if (muted.current) {
        // Start playing silently — volume stays 0, audio runs in background
        da.volume = 0;
        da.play().catch(() => {});
      } else {
        // Fade in from current volume
        const from = da.paused ? 0 : da.volume;
        if (da.paused) da.play().catch(() => {});
        fadeIds.current.push(fadeVolume(da, from, DEFAULT_VOLUME, FADE_DURATION));
      }
    }

    if (state === 'session-active' || state === 'silent') {
      if (!da.paused) {
        fadeIds.current.push(
          fadeVolume(da, da.volume, 0, FADE_DURATION, () => {
            da.pause();
            // Don't reset currentTime — so unmute resumes mid-track
          })
        );
      }
    }
  }, [clearFades]);

  useEffect(() => {
    const dashboard = new Audio();
    dashboard.src = new URL('../../assets/audio/dashboard-ambient.mp3', import.meta.url).href;
    dashboard.loop = true;
    dashboard.volume = 0;
    dashboard.preload = 'auto';

    dashboardAudio.current = dashboard;
    ready.current = true;

    if (pendingState.current) {
      doTransition(pendingState.current);
      pendingState.current = null;
    }

    // Mute toggle — volume only, no pause/play
    const unsubMute = window.promethee.audio?.onMuteToggle?.((isMuted: boolean) => {
      muted.current = isMuted;
      const da = dashboardAudio.current;
      if (!da) return;

      clearFades();

      if (isMuted) {
        // Just silence — keep playing so position is preserved
        fadeIds.current.push(fadeVolume(da, da.volume, 0, 600));
      } else {
        // Restore volume only if we're in dashboard state
        if (currentState.current === 'dashboard') {
          if (da.paused) da.play().catch(() => {});
          fadeIds.current.push(fadeVolume(da, da.volume, DEFAULT_VOLUME, 600));
        }
      }
    });

    return () => {
      clearFades();
      dashboard.pause();
      ready.current = false;
      unsubMute?.();
    };
  }, []);

  const transitionTo = useCallback((state: AudioState) => {
    if (currentState.current === state) return;
    if (!ready.current) {
      pendingState.current = state;
      return;
    }
    doTransition(state);
  }, [doTransition]);

  return { transitionTo };
}
