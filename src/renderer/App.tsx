import React, { useState, useEffect } from 'react';
import FloatingOverlay from './components/FloatingOverlay';
import FullWindow from './components/FullWindow';
import OnboardingScreen from './components/OnboardingScreen';
import PermissionsOnboardingScreen from './components/PermissionsOnboardingScreen';
import { initTheme } from '@/hooks/useTheme';
import './App.css';

// Apply saved theme before first render to avoid flash
initTheme();

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string };
}

function App() {
  const [mode, setMode] = useState('floating');
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [permsOnboardingSeen, setPermsOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode') || 'floating';
    setMode(urlMode);

    if (window.promethee?.auth) {
      window.promethee.auth.getUser().then((result: { success: boolean; user?: User }) => {
        if (result.success && result.user) {
          setUser(result.user);
        }
        setAuthChecked(true);
      }).catch((error: Error) => {
        console.error('Error getting user:', error);
        setAuthChecked(true);
      });

      // Check if permissions onboarding has been seen
      if ((window.promethee as any).onboarding) {
        (window.promethee as any).onboarding.permsSeen().then((seen: boolean) => {
          setPermsOnboardingSeen(seen);
        }).catch(() => {
          setPermsOnboardingSeen(true); // fail open — don't block the app
        });
      } else {
        setPermsOnboardingSeen(true);
      }

      // Listen for deep link auth callback (promethee://auth/callback)
      const removeSuccess = window.promethee.auth.onAuthSuccess((authenticatedUser: User) => {
        setUser(authenticatedUser);
      });
      const removeSignedOut = window.promethee.auth.onSignedOut(() => {
        setUser(null);
      });
      return () => { removeSuccess(); removeSignedOut(); };
    } else {
      setAuthChecked(true);
      setPermsOnboardingSeen(true);
    }
  }, []);

  // Wait for auth check before rendering (avoids flash of onboarding for existing users)
  if (!authChecked) return null;

  // Full window: gate on auth
  if (mode === 'full') {
    if (!user) return <OnboardingScreen onAuthenticated={(u) => {
      setUser(u);
      // Re-fetch perms-seen state from disk after auth — don't guess
      if ((window.promethee as any).onboarding) {
        (window.promethee as any).onboarding.permsSeen().then((seen: boolean) => {
          setPermsOnboardingSeen(seen);
        }).catch(() => setPermsOnboardingSeen(true));
      } else {
        setPermsOnboardingSeen(true);
      }
    }} />;
    if (permsOnboardingSeen === null) return null; // still loading
    if (!permsOnboardingSeen) {
      return <PermissionsOnboardingScreen onDone={() => setPermsOnboardingSeen(true)} />;
    }
    return <FullWindow user={user} setUser={setUser} />;
  }

  // Floating overlay: only show if user is signed in
  if (!user) return null;

  return <FloatingOverlay user={user} setUser={setUser} />;
}

export default App;
