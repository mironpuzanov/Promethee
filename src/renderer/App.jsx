import React, { useState, useEffect } from 'react';
import FloatingOverlay from './components/FloatingOverlay';
import FullWindow from './components/FullWindow';
import './App.css';

function App() {
  const [mode, setMode] = useState('floating');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get mode from URL params
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode') || 'floating';
    setMode(urlMode);

    // Get user - with error handling
    if (window.promethee && window.promethee.auth) {
      window.promethee.auth.getUser().then(result => {
        if (result.success && result.user) {
          setUser(result.user);
        }
      }).catch(error => {
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
