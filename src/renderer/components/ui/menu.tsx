// 1. Import Dependencies
import * as React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import StartFocusButton from './StartFocusButton';

// 2. Define Prop Types
interface NavItem {
  icon: React.ReactNode;
  label: string;
  id: string;
  isSeparator?: boolean;
  isChild?: boolean;
  isGroupHeader?: boolean;
  isOpen?: boolean;
  comingSoon?: boolean;
  badge?: number;
}

interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
}

interface UserProfileSidebarProps {
  user: UserProfile;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  logoutItem: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };
  onStartFocusSession?: () => void;
  className?: string;
}

// 3. Define Animation Variants
const sidebarVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

// 4. Create the Component
export const UserProfileSidebar = React.forwardRef<HTMLDivElement, UserProfileSidebarProps>(
  ({ user, navItems, activeTab, onTabChange, logoutItem, onStartFocusSession, className }, ref) => {
    return (
      <motion.aside
        ref={ref}
        className={cn(
          'flex h-full w-full flex-col bg-card p-4 text-card-foreground',
          className
        )}
        initial="hidden"
        animate="visible"
        variants={sidebarVariants}
        aria-label="User Profile Menu"
      >
        {/* User Info Header */}
        <motion.div variants={itemVariants} className="flex items-center space-x-4 p-2">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`${user.name}'s avatar`}
              className="h-12 w-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-base font-semibold text-muted-foreground">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col truncate">
            <span className="font-semibold text-lg text-foreground">{user.name}</span>
            <span className="text-sm text-muted-foreground truncate">{user.email}</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="my-4 border-t border-border" />

        {/* Start Focus Session CTA — above nav */}
        {onStartFocusSession && (
          <>
            <motion.div variants={itemVariants} className="mb-3">
              <StartFocusButton onClick={onStartFocusSession} />
            </motion.div>
            <motion.div variants={itemVariants} className="mb-4 border-t border-border" />
          </>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1" role="navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                {item.isSeparator && (
                  <motion.div layout className="h-6" />
                )}
                <motion.button
                  layout
                  variants={itemVariants}
                  onClick={() => { if (!item.comingSoon) onTabChange(item.id); }}
                  className={cn(
                    'group flex w-full items-center rounded-md text-sm font-medium transition-colors text-left',
                    item.isChild ? 'px-3 py-2 pl-8' : 'px-3 py-2.5',
                    isActive
                      ? 'text-foreground bg-accent'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className={cn('flex items-center justify-center flex-shrink-0', item.isChild ? 'mr-2 h-4 w-4' : 'mr-3 h-5 w-5')}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: 'var(--accent-fire, #e8922a)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : item.comingSoon ? (
                    <span className="ml-auto text-[10px] tracking-wide text-muted-foreground/50">coming soon</span>
                  ) : item.isGroupHeader ? (
                    <ChevronRight
                      className={cn('ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform', item.isOpen && 'rotate-90')}
                    />
                  ) : !item.isChild ? (
                    <ChevronRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  ) : null}
                </motion.button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Logout Button */}
        <motion.div variants={itemVariants} className="mt-2">
          <button
            onClick={logoutItem.onClick}
            className="group flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <span className="mr-3 flex h-5 w-5 items-center justify-center flex-shrink-0">
              {logoutItem.icon}
            </span>
            <span>{logoutItem.label}</span>
          </button>
        </motion.div>
      </motion.aside>
    );
  }
);

UserProfileSidebar.displayName = 'UserProfileSidebar';
