import React from 'react';
import { Home, ScrollText, Sword, CheckSquare, Zap, BookOpen, MessageCircle } from 'lucide-react';
import { UserProfileSidebar } from '@/components/ui/menu';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navItems = [
  { id: 'home',    label: 'Home',    icon: <Home size={14} /> },
  { id: 'log',     label: 'Log',     icon: <ScrollText size={14} /> },
  { id: 'quests',  label: 'Quests',  icon: <Sword size={14} /> },
  { id: 'habits',  label: 'Habits',  icon: <CheckSquare size={14} /> },
  { id: 'skills',  label: 'Skills',  icon: <Zap size={14} />, isSeparator: true },
  { id: 'journal', label: 'Journal', icon: <BookOpen size={14} /> },
  { id: 'mentor',  label: 'Mentor',  icon: <MessageCircle size={14} /> },
];

function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <UserProfileSidebar
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}

export default Sidebar;
