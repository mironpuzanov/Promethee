import React, { useState } from 'react';
import {
  Home, Layers, CheckSquare, CheckCheck, LogOut, Users, Trophy, Settings, Brain, Sparkles
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
  unreadCoach?: number;
}

const COMMUNITY_CHILDREN = [
  { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={15} /> },
  { id: 'rooms',       label: 'Rooms',       icon: <Users size={15} /> },
];

const BASE_NAV_ITEMS = [
  { id: 'home',      label: 'Home',      icon: <Home size={18} /> },
  { id: 'sessions',  label: 'Session',   icon: <Layers size={18} /> },
  { id: 'coach',     label: 'Mentor AI', icon: <Sparkles size={18} /> },
  { id: 'todo',      label: 'To-do',     icon: <CheckCheck size={18} /> },
  { id: 'habits',    label: 'Habits',    icon: <CheckSquare size={18} /> },
  { id: 'community', label: 'Community', icon: <Users size={18} />, children: COMMUNITY_CHILDREN },
  { id: 'memory',    label: 'Memory',    icon: <Brain size={18} /> },
];

const COMMUNITY_TABS = new Set(['leaderboard', 'rooms']);

function Sidebar({ activeTab, setActiveTab, user, unreadCoach = 0 }: SidebarProps) {
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

  // Inject unread badge on coach item
  const navItems = BASE_NAV_ITEMS.map(item =>
    item.id === 'coach' && unreadCoach > 0 ? { ...item, badge: unreadCoach } : item
  );

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
      onSettings={() => setActiveTab('settings')}
      onStartFocusSession={() => window.promethee.window.startFocusSession(null)}
      className="pt-14"
    />
  );
}

export default Sidebar;
