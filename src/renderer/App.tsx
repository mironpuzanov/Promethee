import React, { useState, useEffect } from 'react';
import FloatingOverlay from './components/FloatingOverlay';
import FullWindow from './components/FullWindow';
import './App.css';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string };
}

function App() {
  const [mode, setMode] = useState('floating');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode') || 'floating';
    setMode(urlMode);

    if (window.promethee?.auth) {
      window.promethee.auth.getUser().then((result: { success: boolean; user?: User }) => {
        if (result.success && result.user) {
          setUser(result.user);
        }
      }).catch((error: Error) => {
        console.error('Error getting user:', error);
      });
    }
  }, []);

  if (mode === 'full') {
    return <FullWindow user={user} setUser={setUser} />;
  }

  return <FloatingOverlay user={user} setUser={setUser} />;
}

export default App;
