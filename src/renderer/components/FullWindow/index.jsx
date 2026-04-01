import React, { useState } from 'react';
import Sidebar from './Sidebar';
import CharacterPanel from './CharacterPanel';
import RightPanel from './RightPanel';
import './FullWindow.css';

function FullWindow({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="full-window">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <CharacterPanel user={user} />
      <RightPanel user={user} />
    </div>
  );
}

export default FullWindow;
