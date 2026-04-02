import React, { useState, useEffect } from 'react';
import FloatingOverlay from './components/FloatingOverlay';
import FullWindow from './components/FullWindow';
import OnboardingScreen from './components/OnboardingScreen';
import './App.css';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string };
}

function App() {
  const [mode, setMode] = useState('floating');
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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
    }
  }, []);

  // Wait for auth check before rendering (avoids flash of onboarding for existing users)
  if (!authChecked) return null;

  // Full window: gate on auth
  if (mode === 'full') {
    if (!user) return <OnboardingScreen onAuthenticated={setUser} />;
    return <FullWindow user={user} setUser={setUser} />;
  }

  // Floating overlay: only show if user is signed in
  if (!user) return null;

  return <FloatingOverlay user={user} setUser={setUser} />;
}

export default App;
