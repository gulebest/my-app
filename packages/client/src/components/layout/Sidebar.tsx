import {
   Home,
   MessageCircle,
   Folder,
   BarChart,
   Settings,
   Bell,
   Search,
   User,
   Plus,
   LogOut,
   X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import cn from 'clsx';
import { navigateTo } from '../../lib/navigation';
import type { AuthUser } from '../../lib/auth-storage';
import type { ConversationSummary } from '../../lib/conversation-history-api';

const openSettings = () => alert('Settings modal would open.');
const openUpdates = () => alert('Updates & FAQ modal would open.');
const upgradeToPro = () => {
   window.open(
      'https://your-upgrade-link.com',
      '_blank',
      'noopener,noreferrer'
   );
};
interface SidebarProps {
   currentUser: AuthUser | null;
   onSignInClick: () => void;
   onSignUpClick: () => void;
   onLogout: () => void;
   historyItems: ConversationSummary[];
   historyLoading: boolean;
   activeConversationId: string | null;
   onSelectConversation: (conversationId: string) => void;
   onNewConversation: () => void;
   className?: string;
   onClose?: () => void;
}

function formatHistoryTime(isoTime: string | null) {
   if (!isoTime) {
      return '';
   }

   const parsed = new Date(isoTime);
   if (Number.isNaN(parsed.getTime())) {
      return '';
   }

   return parsed.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
   });
}

export function Sidebar({
   currentUser,
   onSignInClick,
   onSignUpClick,
   onLogout,
   historyItems,
   historyLoading,
   activeConversationId,
   onSelectConversation,
   onNewConversation,
   className,
   onClose,
}: SidebarProps) {
   const [templatesOpen, setTemplatesOpen] = useState(false);

   const handleRoute = (path: string) => {
      navigateTo(path);
      onClose?.();
   };

   return (
      <aside
         className={cn(
            'app-scroll flex h-full w-72 flex-col gap-4 overflow-y-auto border-r border-[var(--app-divider)] bg-[var(--app-sidebar-bg)] p-4 text-(--app-text-strong) sm:p-6',
            className
         )}
      >
         <div className="mb-4 flex items-center gap-3 sm:mb-6">
            <div className="rounded-xl bg-[#23244a] p-2">
               <Home className="h-7 w-7 text-indigo-400" />
            </div>
            <span className="text-lg font-bold tracking-wide sm:text-xl">
               Assistly
            </span>
            {onClose && (
               <button
                  type="button"
                  className="ml-auto rounded-lg p-2 transition hover:bg-[var(--app-soft-surface)] lg:hidden"
                  onClick={onClose}
                  aria-label="Close sidebar"
               >
                  <X className="h-5 w-5 text-(--app-text-muted)" />
               </button>
            )}
         </div>

         <div className="relative mb-2">
            <input
               className="w-full rounded-xl bg-[var(--app-soft-surface)] py-2 pl-10 pr-3 text-sm placeholder:text-(--app-text-muted) focus:outline-none"
               placeholder="Search"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
         </div>

         <nav className="flex flex-col gap-1">
            <SidebarItem
               icon={<MessageCircle />}
               label="Chat Helper"
               onClick={() => handleRoute('/chat')}
               active={window.location.pathname === '/chat'}
            />
            <SidebarItem
               icon={<Plus />}
               label="New chat"
               onClick={() => {
                  onNewConversation();
                  onClose?.();
               }}
            />
            <SidebarItem
               icon={<Plus />}
               label="Templates"
               expandable
               expanded={templatesOpen}
               onClick={() => setTemplatesOpen((open) => !open)}
            />
            {templatesOpen && (
               <div className="ml-8 flex flex-col gap-1 text-sm text-(--app-text-muted)">
                  <button
                     className="text-left hover:text-indigo-400"
                     onClick={() => alert('Template 1 selected')}
                  >
                     Template 1
                  </button>
                  <button
                     className="text-left hover:text-indigo-400"
                     onClick={() => alert('Template 2 selected')}
                  >
                     Template 2
                  </button>
               </div>
            )}
            <SidebarItem
               icon={<Folder />}
               label="My projects"
               onClick={() => handleRoute('/projects')}
            />
            <SidebarItem
               icon={<BarChart />}
               label="Statistics"
               onClick={() => handleRoute('/stats')}
            />
         </nav>

         <div className="mt-3 flex-none pb-5">
            <div className="mb-2 text-xs text-(--app-text-muted)">
               CONVERSATION HISTORY
            </div>
            {currentUser ? (
               <div className="app-scroll max-h-52 space-y-2 overflow-y-auto pr-1">
                  {historyLoading ? (
                     <p className="text-xs text-(--app-text-muted)">
                        Loading history...
                     </p>
                  ) : historyItems.length === 0 ? (
                     <p className="text-xs text-(--app-text-muted)">
                        No saved conversations yet.
                     </p>
                  ) : (
                     historyItems.map((item) => (
                        <button
                           key={item.conversationId}
                           type="button"
                           onClick={() => {
                              onSelectConversation(item.conversationId);
                              onClose?.();
                           }}
                           className={cn(
                              'w-full rounded-xl border px-3 py-2 text-left transition',
                              item.conversationId === activeConversationId
                                 ? 'border-indigo-400 bg-indigo-500/15'
                                 : 'border-[var(--app-card-border)] bg-[var(--app-card-bg)] hover:bg-[var(--app-soft-surface)]'
                           )}
                        >
                           <p className="truncate text-xs font-semibold text-(--app-text-strong)">
                              {item.title || 'New conversation'}
                           </p>
                           <p className="truncate text-[11px] text-(--app-text-muted)">
                              {item.lastMessage || 'No messages yet'}
                           </p>
                           <p className="mt-1 text-[10px] text-(--app-text-muted)">
                              {formatHistoryTime(
                                 item.updatedAt || item.createdAt
                              )}
                           </p>
                        </button>
                     ))
                  )}
               </div>
            ) : (
               <p className="text-xs text-(--app-text-muted)">
                  Sign in to view full conversation history.
               </p>
            )}
         </div>

         <div className="flex-none border-t border-[var(--app-divider)] pt-5">
            <div className="mb-1 text-xs text-(--app-text-muted)">
               SETTINGS & HELP
            </div>
            <SidebarItem
               icon={<Settings />}
               label="Settings"
               onClick={() => {
                  openSettings();
                  onClose?.();
               }}
            />
            <SidebarItem
               icon={<Bell />}
               label="Updates & FAQ"
               onClick={() => {
                  openUpdates();
                  onClose?.();
               }}
            />
         </div>

         <div className="mt-6 flex flex-col items-start gap-2 rounded-2xl border border-[var(--app-card-border)] bg-gradient-to-br from-[var(--app-card-from)] to-[var(--app-card-to)] p-4 shadow-[0_14px_28px_rgba(6,8,18,0.35)]">
            <div className="text-sm font-semibold">Assistly Pro Plan</div>
            <div className="text-xs text-(--app-text-muted)">
               Complete freedom.
               <br />
               Maximum performance.
            </div>
            <button
               className="mt-2 rounded-xl bg-indigo-500 px-4 py-1 text-xs font-semibold text-white transition hover:bg-indigo-600"
               onClick={upgradeToPro}
            >
               Upgrade to Pro
            </button>
         </div>

         {currentUser ? (
            <div className="mt-auto flex items-center gap-3 rounded-xl bg-[var(--app-card-bg)] p-3">
               <User className="h-8 w-8 text-indigo-400" />
               <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                     {currentUser.fullName}
                  </div>
                  <div className="truncate text-xs text-(--app-text-muted)">
                     {currentUser.email}
                  </div>
               </div>
               <button
                  onClick={() => {
                     onLogout();
                     onClose?.();
                  }}
                  title="Logout"
               >
                  <LogOut className="h-5 w-5 cursor-pointer text-gray-400" />
               </button>
            </div>
         ) : (
            <div className="mt-auto rounded-xl bg-[var(--app-card-bg)] p-3">
               <div className="mb-2 text-sm font-semibold text-(--app-text-strong)">
                  Guest Session
               </div>
               <p className="mb-3 text-xs text-(--app-text-muted)">
                  Sign in to save chat history and account settings.
               </p>
               <div className="flex gap-2">
                  <button
                     type="button"
                     onClick={() => {
                        onSignInClick();
                        onClose?.();
                     }}
                     className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
                  >
                     Sign In
                  </button>
                  <button
                     type="button"
                     onClick={() => {
                        onSignUpClick();
                        onClose?.();
                     }}
                     className="flex-1 rounded-lg border border-(--app-input-border) px-3 py-2 text-xs font-semibold text-(--app-text-strong) hover:bg-[var(--app-soft-surface)]"
                  >
                     Sign Up
                  </button>
               </div>
            </div>
         )}
      </aside>
   );
}

interface SidebarItemProps {
   icon: ReactNode;
   label: string;
   active?: boolean;
   expandable?: boolean;
   expanded?: boolean;
   onClick?: () => void;
}

function SidebarItem({
   icon,
   label,
   active,
   expandable,
   expanded,
   onClick,
}: SidebarItemProps) {
   return (
      <button
         type="button"
         className={cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition',
            active
               ? 'bg-gradient-to-r from-[#5863ff] to-[#4f59e8] font-semibold text-white'
               : 'text-(--app-text-muted) hover:bg-[var(--app-soft-surface)]',
            expandable && 'justify-between'
         )}
         onClick={onClick}
         aria-expanded={expandable ? expanded : undefined}
      >
         <span className="flex items-center gap-2">
            {icon} {label}
         </span>
         {expandable && (
            <Plus
               className={cn(
                  'h-4 w-4 text-gray-400 transition-transform',
                  expanded && 'rotate-45'
               )}
            />
         )}
      </button>
   );
}
