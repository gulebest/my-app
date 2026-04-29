import { useEffect, useState } from 'react';
import { Bell, Sun, Moon, ChevronDown } from 'lucide-react';

export function Topbar() {
   const [dropdownOpen, setDropdownOpen] = useState(false);
   const [notificationsOpen, setNotificationsOpen] = useState(false);
   const [isLightTheme, setIsLightTheme] = useState(() => {
      if (typeof window === 'undefined') {
         return false;
      }
      return window.localStorage.getItem('assistly-theme') === 'light';
   });

   useEffect(() => {
      document.documentElement.classList.toggle('theme-light', isLightTheme);
      window.localStorage.setItem(
         'assistly-theme',
         isLightTheme ? 'light' : 'dark'
      );
   }, [isLightTheme]);

   // Placeholder: implement real dropdown, notifications, and theme logic as needed
   const handleDropdown = () => setDropdownOpen((v) => !v);
   const handleNotifications = () => setNotificationsOpen((v) => !v);
   const handleThemeToggle = () => {
      setIsLightTheme((v) => !v);
   };

   return (
      <header className="relative flex h-16 items-center justify-between border-b border-[var(--app-divider)] bg-[var(--app-header-bg)] px-6 md:px-8">
         {/* App Title and Dropdown */}
         <div className="flex items-center gap-3 relative">
            <span className="text-lg font-semibold text-(--app-text-strong)">
               Messaging app
            </span>
            <button
               className="ml-2 flex items-center gap-1 rounded-lg bg-[var(--app-soft-surface)] px-2 py-1 text-sm text-(--app-text-muted)"
               onClick={handleDropdown}
               aria-expanded={dropdownOpen}
            >
               <ChevronDown
                  className={
                     dropdownOpen
                        ? 'w-4 h-4 rotate-180 transition'
                        : 'w-4 h-4 transition'
                  }
               />
            </button>
            {dropdownOpen && (
               <div className="absolute left-0 top-12 z-20 min-w-[180px] rounded-xl bg-[var(--app-soft-surface)] px-4 py-2 text-(--app-text-strong) shadow-lg">
                  <div className="cursor-pointer rounded px-2 py-1 hover:bg-[var(--app-card-bg)]">
                     Workspace 1
                  </div>
                  <div className="cursor-pointer rounded px-2 py-1 hover:bg-[var(--app-card-bg)]">
                     Workspace 2
                  </div>
                  <div className="cursor-pointer rounded px-2 py-1 hover:bg-[var(--app-card-bg)]">
                     New workspace...
                  </div>
               </div>
            )}
         </div>
         {/* Actions */}
         <div className="flex items-center gap-4 relative">
            <button
               className="relative rounded-full bg-[var(--app-soft-surface)] p-2 transition hover:opacity-85"
               onClick={handleNotifications}
               aria-expanded={notificationsOpen}
            >
               <Bell className="h-5 w-5 text-(--app-text-muted)" />
               <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
            </button>
            {notificationsOpen && (
               <div className="absolute right-0 top-12 z-20 min-w-[220px] rounded-xl bg-[var(--app-soft-surface)] px-4 py-2 text-(--app-text-strong) shadow-lg">
                  <div className="px-2 py-1 text-sm text-(--app-text-muted)">
                     No new notifications
                  </div>
               </div>
            )}
            <button
               className="rounded-full bg-[var(--app-soft-surface)] p-2 transition hover:opacity-85"
               onClick={handleThemeToggle}
               aria-pressed={isLightTheme}
               title={
                  isLightTheme
                     ? 'Switch to dark theme'
                     : 'Switch to light theme'
               }
            >
               {isLightTheme ? (
                  <Moon className="w-5 h-5 text-[#4f59e8]" />
               ) : (
                  <Sun className="w-5 h-5 text-yellow-400" />
               )}
            </button>
         </div>
      </header>
   );
}
