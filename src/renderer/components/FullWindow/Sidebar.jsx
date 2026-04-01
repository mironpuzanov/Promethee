import React from 'react';
import './Sidebar.css';

function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'log', label: 'Log' },
    { id: 'quests', label: 'Quests' },
    { id: 'habits', label: 'Habits' },
    { id: 'skills', label: 'Skills' },
    { id: 'journal', label: 'Journal' },
    { id: 'mentor', label: 'Mentor' }
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
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
