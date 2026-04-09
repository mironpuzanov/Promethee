import React, { useState } from 'react';
import {
  Home, ScrollText, Sword, CheckSquare, MessageCircle, LogOut, Users, Trophy, Settings, Brain, ListChecks
} from 'lucide-react';
import { UserProfileSidebar } from '../ui/menu';
import { MVP_MODE, MVP_NAV } from '../../../config/mvp';

interface User {
  id: string;
  email: string;
  user_metadata?: { display_name?: string; avatar_url?: string };
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
}

const COMMUNITY_CHILDREN = [
  { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={15} /> },
  { id: 'rooms',       label: 'Rooms',       icon: <Users size={15} /> },
];

const navItems = [
  { id: 'home',    label: 'Home',    icon: <Home size={18} /> },
  { id: 'log',     label: 'Sessions', icon: <ScrollText size={18} /> },
  { id: 'tasks',   label: 'Focus Log', icon: <ListChecks size={18} /> },
  { id: 'mentor',  label: 'Mentor',  icon: <MessageCircle size={18} /> },
  { id: 'community', label: 'Community', icon: <Users size={18} />, children: COMMUNITY_CHILDREN },
  { id: 'quests',  label: 'Quests',  icon: <Sword size={18} />, isSeparator: true },
  { id: 'habits',  label: 'Habits',  icon: <CheckSquare size={18} /> },
  { id: 'memory',  label: 'Memory',  icon: <Brain size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />, isSeparator: true },
];

const COMMUNITY_TABS = new Set(['leaderboard', 'rooms']);

function Sidebar({ activeTab, setActiveTab, user }: SidebarProps) {
  const [communityOpen, setCommunityOpen] = useState(
    COMMUNITY_TABS.has(activeTab) || activeTab === 'community'
  );

  const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest';
  const userEmail = user?.email || '';

  const userProfile = {
    name: userName,
    email: userEmail,
    avatarUrl: user?.user_metadata?.avatar_url || '',
  };

  const logoutItem = {
    label: 'Log out',
    icon: <LogOut size={18} />,
    onClick: () => window.promethee.auth.signOut(),
  };

  // Filter nav items by MVP_NAV when MVP_MODE is on
  const visibleItems = MVP_MODE
    ? navItems.filter((item) => (MVP_NAV as readonly string[]).includes(item.id))
    : navItems;

  // Build nav items, replacing 'community' with the expandable group for UserProfileSidebar
  const flatItems = visibleItems.flatMap((item) => {
    if (item.id === 'community') {
      // Always include the group header; children shown conditionally
      const headerItem = {
        id: 'community',
        label: 'Community',
        icon: (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Users size={18} />
          </span>
        ),
        onClick: () => setCommunityOpen(o => !o),
        isGroupHeader: true,
        isOpen: communityOpen,
      };
      if (communityOpen) {
        return [
          headerItem,
          ...COMMUNITY_CHILDREN.map(c => ({ ...c, isChild: true })),
        ];
      }
      return [headerItem];
    }
    return [item];
  });

  // Which tab is "active" for highlighting — community children take priority
  const effectiveActive = COMMUNITY_TABS.has(activeTab) ? activeTab : activeTab;

  return (
    <UserProfileSidebar
      user={userProfile}
      navItems={flatItems}
      activeTab={effectiveActive}
      onTabChange={(id) => {
        if (id === 'community') {
          setCommunityOpen(o => !o);
        } else {
          setActiveTab(id);
        }
      }}
      logoutItem={logoutItem}
      onStartFocusSession={() => window.promethee.window.startFocusSession(null)}
      className="pt-14"
    />
  );
}

export default Sidebar;
