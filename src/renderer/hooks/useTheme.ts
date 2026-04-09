import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'promethee:theme';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  return [theme, setTheme];
}

// Call once at app start to avoid flash.
// Also re-syncs when the window gains focus so the floating overlay
// picks up theme changes made in the dashboard (separate renderer process).
export function initTheme() {
  const apply = () => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  };
  apply();
  window.addEventListener('focus', apply);
}
