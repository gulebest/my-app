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
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import cn from 'clsx';

const navigateTo = (path: string) => {
   window.location.assign(path);
};

const openSettings = () => alert('Settings modal would open.');
const openUpdates = () => alert('Updates & FAQ modal would open.');
const upgradeToPro = () => {
   window.open(
      'https://your-upgrade-link.com',
      '_blank',
      'noopener,noreferrer'
   );
};
const logout = () => alert('You have been logged out.');

export function Sidebar() {
   const [templatesOpen, setTemplatesOpen] = useState(false);

   return (
      <aside className="flex h-full w-72 flex-col gap-4 overflow-y-auto border-r border-[var(--app-divider)] bg-[var(--app-sidebar-bg)] p-6 text-[var(--app-text-strong)]">
         <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-[#23244a] p-2">
               <Home className="h-7 w-7 text-indigo-400" />
            </div>
            <span className="text-xl font-bold tracking-wide">Assistly</span>
         </div>

         <div className="relative mb-2">
            <input
               className="w-full rounded-xl bg-[var(--app-soft-surface)] py-2 pl-10 pr-3 text-sm placeholder:text-[var(--app-text-muted)] focus:outline-none"
               placeholder="Search"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
         </div>

         <nav className="flex flex-col gap-1">
            <SidebarItem
               icon={<MessageCircle />}
               label="Chat Helper"
               onClick={() => navigateTo('/chat')}
               active
            />
            <SidebarItem
               icon={<Plus />}
               label="Templates"
               expandable
               expanded={templatesOpen}
               onClick={() => setTemplatesOpen((open) => !open)}
            />
            {templatesOpen && (
               <div className="ml-8 flex flex-col gap-1 text-sm text-[var(--app-text-muted)]">
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
               onClick={() => navigateTo('/projects')}
            />
            <SidebarItem
               icon={<BarChart />}
               label="Statistics"
               onClick={() => navigateTo('/stats')}
            />
         </nav>

         <div className="mt-6">
            <div className="mb-1 text-xs text-[var(--app-text-muted)]">
               SETTINGS & HELP
            </div>
            <SidebarItem
               icon={<Settings />}
               label="Settings"
               onClick={openSettings}
            />
            <SidebarItem
               icon={<Bell />}
               label="Updates & FAQ"
               onClick={openUpdates}
            />
         </div>

         <div className="mt-6 flex flex-col items-start gap-2 rounded-2xl border border-[var(--app-card-border)] bg-gradient-to-br from-[var(--app-card-from)] to-[var(--app-card-to)] p-4 shadow-[0_14px_28px_rgba(6,8,18,0.35)]">
            <div className="text-sm font-semibold">Assistly Pro Plan</div>
            <div className="text-xs text-[var(--app-text-muted)]">
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

         <div className="mt-auto flex items-center gap-3 rounded-xl bg-[var(--app-card-bg)] p-3">
            <User className="h-8 w-8 text-indigo-400" />
            <div className="flex-1">
               <div className="text-sm font-medium">Jeoffrey N.</div>
               <div className="text-xs text-[var(--app-text-muted)]">
                  hey@jeoffrey.info
               </div>
            </div>
            <button onClick={logout} title="Logout">
               <LogOut className="h-5 w-5 cursor-pointer text-gray-400" />
            </button>
         </div>
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
               : 'text-[var(--app-text-muted)] hover:bg-[var(--app-soft-surface)]',
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
