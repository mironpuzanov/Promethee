import React from 'react';
import {
  Home, ScrollText, Sword, CheckSquare, Zap, BookOpen, MessageCircle, LogOut
} from 'lucide-react';
import { UserProfileSidebar } from '@/components/ui/menu';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string };
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
}

const navItems = [
  { id: 'home',    label: 'Home',    icon: <Home size={18} /> },
  { id: 'log',     label: 'Log',     icon: <ScrollText size={18} /> },
  { id: 'quests',  label: 'Quests',  icon: <Sword size={18} /> },
  { id: 'habits',  label: 'Habits',  icon: <CheckSquare size={18} /> },
  { id: 'skills',  label: 'Skills',  icon: <Zap size={18} />, isSeparator: true },
  { id: 'journal', label: 'Journal', icon: <BookOpen size={18} /> },
  { id: 'mentor',  label: 'Mentor',  icon: <MessageCircle size={18} /> },
];

function Sidebar({ activeTab, setActiveTab, user }: SidebarProps) {
  const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';
  const userEmail = user?.email || '';

  const userProfile = {
    name: userName,
    email: userEmail,
    avatarUrl: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=200&auto=format&fit=crop&q=60',
  };

  const logoutItem = {
    label: 'Log out',
    icon: <LogOut size={18} />,
    onClick: () => window.promethee.auth.signOut(),
  };

  return (
    <UserProfileSidebar
      user={userProfile}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      logoutItem={logoutItem}
      className="pt-14"
    />
  );
}

export default Sidebar;
