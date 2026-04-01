import React from 'react';
import './Sidebar.css';

function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: '⌂' },
    { id: 'log', label: 'Log', icon: '📊' },
    { id: 'quests', label: 'Quests', icon: '⚔' },
    { id: 'habits', label: 'Habits', icon: '✓' },
    { id: 'skills', label: 'Skills', icon: '⚡' },
    { id: 'journal', label: 'Journal', icon: '📝' },
    { id: 'mentor', label: 'Mentor', icon: '🔥' }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">⋮⋮</div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
