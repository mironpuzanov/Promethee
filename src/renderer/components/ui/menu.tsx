import * as React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  id: string;
  isSeparator?: boolean;
}

interface UserProfileSidebarProps {
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

const sidebarVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
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

export const UserProfileSidebar = React.forwardRef<HTMLDivElement, UserProfileSidebarProps>(
  ({ navItems, activeTab, onTabChange, className }, ref) => {
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
        aria-label="Navigation"
      >
        {/* Promethee dot mark */}
        <motion.div variants={itemVariants} className="flex gap-[3px] px-2 pb-6 pt-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full bg-muted-foreground/30" />
          ))}
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1" role="navigation">
          {navItems.map((item, index) => {
            const isActive = activeTab === item.id;
            return (
              <React.Fragment key={index}>
                {item.isSeparator && (
                  <motion.div variants={itemVariants} className="h-6" />
                )}
                <motion.button
                  variants={itemVariants}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'group flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className="mr-3 h-4 w-4 flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                  <ChevronRight
                    className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </motion.button>
              </React.Fragment>
            );
          })}
        </nav>
      </motion.aside>
    );
  }
);

UserProfileSidebar.displayName = 'UserProfileSidebar';
